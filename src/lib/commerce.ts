import "server-only";
import { supabaseAdmin } from "./supabase";
import type { L10n } from "./i18n";
import { normaliseFrozenPack, type FrozenPack } from "./frozen";

/** Frozen packaging settings (box size, price per box). */
export async function getFrozenPack(): Promise<FrozenPack> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.frozen_pack").maybeSingle();
  return normaliseFrozenPack(data?.value);
}

/** Delivery area: by default orders are delivered inside Germany only. */
export async function getShippingArea(): Promise<{ abroad: boolean }> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.shipping_area").maybeSingle();
  return { abroad: (data?.value as { abroad?: boolean } | null)?.abroad === true };
}

/** Packaging settings plus the frozen courier price, for the cart illustration. */
export async function getFrozenInfo(): Promise<{ pack: FrozenPack; courier: number | null }> {
  const [pack, { data }] = await Promise.all([
    getFrozenPack(),
    supabaseAdmin().from("shipping_methods").select("price").eq("type", "frozen").eq("active", true).order("price").limit(1),
  ]);
  return { pack, courier: data?.[0] ? Number(data[0].price) : null };
}

// ---------------------------------------------------------------------------------------------
// Everything the owner configures for checkout lives in the settings table:
//   public.pickup     – pickup days, time windows, capacity, closed days
//   public.payments   – which payment methods are on, deposit rules, bank-transfer details
//   private.payments  – API keys of the payment providers, encrypted (staff-only row)
// Nothing here is hard-coded; environment variables only act as a fallback.
// ---------------------------------------------------------------------------------------------

// ---------------- encryption for stored keys ----------------

async function key() {
  const base = process.env.SETTINGS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) throw new Error("Server key missing");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`greenland-settings-v1:${base}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptJson(v: unknown): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(v))));
  return { iv: b64(iv), data: b64(data) };
}

export async function decryptJson<T>(box: unknown): Promise<T | null> {
  const b = box as { iv?: string; data?: string } | null;
  if (!b?.iv || !b?.data) return null;
  try {
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(b.iv) }, await key(), unb64(b.data));
    return JSON.parse(new TextDecoder().decode(out)) as T;
  } catch {
    return null;
  }
}

// ---------------- pickup ----------------

export type Window = { from: string; to: string }; // "10:00" – "13:00"
export interface PickupSettings {
  slotMinutes: number; // length of one pickup slot
  leadHours: number; // earliest pickup this many hours after ordering
  daysAhead: number; // how far ahead customers can choose
  capacity: number; // orders per slot (0 = unlimited)
  days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", Window[]>;
  closed: string[]; // YYYY-MM-DD
  address: L10n;
  note: L10n;
  allowAsap: boolean; // "I'll call before coming" option
}

export const DEFAULT_PICKUP: PickupSettings = {
  slotMinutes: 60,
  leadHours: 2,
  daysAhead: 7,
  capacity: 0,
  days: {
    mon: [{ from: "10:00", to: "19:00" }],
    tue: [{ from: "10:00", to: "19:00" }],
    wed: [{ from: "10:00", to: "19:00" }],
    thu: [{ from: "10:00", to: "19:00" }],
    fri: [{ from: "10:00", to: "19:00" }],
    sat: [{ from: "10:00", to: "16:00" }],
    sun: [],
  },
  closed: [],
  address: { de: "", en: "" },
  note: { de: "", en: "" },
  allowAsap: true,
};

export async function getPickupSettings(): Promise<PickupSettings> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.pickup").maybeSingle();
  const v = (data?.value ?? {}) as Partial<PickupSettings>;
  return { ...DEFAULT_PICKUP, ...v, days: { ...DEFAULT_PICKUP.days, ...(v.days ?? {}) } };
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const TZ = "Europe/Berlin";

// Formatters are expensive to create; build each once per worker.
let partsFmt: Intl.DateTimeFormat | null = null;
const labelFmt: Record<string, Intl.DateTimeFormat> = {};
const fmtLabel = (lang: string, d: Date) =>
  (labelFmt[lang] ??= new Intl.DateTimeFormat(lang, { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" })).format(d);

/** Berlin wall-clock parts of a moment. */
function berlinParts(d: Date) {
  partsFmt ??= new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

/** Converts a Berlin wall-clock date + time to a real moment. */
function berlinToDate(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const p = berlinParts(guess);
  const diffMin = (Date.UTC(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8, 10), p.hour, p.minute) - guess.getTime()) / 60000;
  return new Date(guess.getTime() - diffMin * 60000);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export interface Slot {
  value: string; // ISO start time
  label: L10n;
  full: boolean;
}

/** The pickup slots customers can choose from right now. */
export async function pickupSlots(s?: PickupSettings, now = new Date()): Promise<Slot[]> {
  s = s ?? (await getPickupSettings());
  const earliest = now.getTime() + s.leadHours * 3600_000;
  const slots: Slot[] = [];
  const step = Math.max(15, Number(s.slotMinutes) || 60);
  for (let i = 0; i <= Math.max(1, s.daysAhead); i++) {
    const day = new Date(now.getTime() + i * 86400_000);
    const date = berlinParts(day).date;
    if (s.closed.includes(date)) continue;
    const wd = DAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    for (const w of s.days[wd] ?? []) {
      for (let m = toMin(w.from); m + step <= toMin(w.to); m += step) {
        const start = berlinToDate(date, fromMin(m));
        if (start.getTime() < earliest) continue;
        const dLabel = (lang: string) => fmtLabel(lang, start);
        const range = `${fromMin(m)}–${fromMin(m + step)}`;
        slots.push({ value: start.toISOString(), label: { de: `${dLabel("de-DE")} · ${range} Uhr`, en: `${dLabel("en-GB")} · ${range}` }, full: false });
      }
    }
  }
  if (s.capacity > 0 && slots.length) {
    const { data } = await supabaseAdmin()
      .from("orders")
      .select("pickup_at")
      .gte("pickup_at", slots[0].value)
      .lte("pickup_at", slots[slots.length - 1].value)
      .not("status", "in", "(cancelled,refunded)");
    const taken = new Map<string, number>();
    for (const o of data ?? []) if (o.pickup_at) taken.set(new Date(o.pickup_at).toISOString(), (taken.get(new Date(o.pickup_at).toISOString()) ?? 0) + 1);
    for (const sl of slots) sl.full = (taken.get(sl.value) ?? 0) >= s.capacity;
  }
  return slots;
}

// ---------------- payments ----------------

export type Method = "stripe" | "paypal" | "viva" | "bank" | "cash";

export interface PaymentPublic {
  stripe: { enabled: boolean; live: boolean; label: L10n };
  paypal: { enabled: boolean; live: boolean; label: L10n };
  viva: { enabled: boolean; live: boolean; label: L10n };
  bank: { enabled: boolean; label: L10n; holder: string; iban: string; bic: string; bankName: string; days: number };
  cash: { enabled: boolean; pickup: boolean; local: boolean; label: L10n };
  deposit: { enabled: boolean; required: boolean; percent: number; fixed: number; minOrder: number };
}

export interface PaymentSecrets {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  paypalSecret?: string;
  vivaClientId?: string;
  vivaSecret?: string;
  vivaSourceCode?: string;
}

export const DEFAULT_PAYMENTS: PaymentPublic = {
  stripe: { enabled: true, live: true, label: { de: "Karte, Apple Pay, Google Pay, Klarna", en: "Card, Apple Pay, Google Pay, Klarna" } },
  paypal: { enabled: true, live: true, label: { de: "PayPal", en: "PayPal" } },
  viva: { enabled: true, live: true, label: { de: "Viva Wallet", en: "Viva Wallet" } },
  bank: { enabled: false, label: { de: "Vorkasse (Überweisung)", en: "Bank transfer in advance" }, holder: "", iban: "", bic: "", bankName: "", days: 7 },
  cash: { enabled: true, pickup: true, local: true, label: { de: "Bar oder Karte bei Abholung / Lieferung", en: "Cash or card on pickup / delivery" } },
  deposit: { enabled: false, required: false, percent: 20, fixed: 0, minOrder: 0 },
};

export interface PaymentConfig {
  pub: PaymentPublic;
  secrets: PaymentSecrets;
  /** online methods that are switched on AND have their keys */
  online: ("stripe" | "paypal" | "viva")[];
  methods: Method[];
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const { data } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.payments", "private.payments"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  const v = (get("public.payments") ?? {}) as Partial<PaymentPublic>;
  const pub = Object.fromEntries(Object.entries(DEFAULT_PAYMENTS).map(([k, d]) => [k, { ...d, ...((v as Record<string, object>)[k] ?? {}) }])) as unknown as PaymentPublic;
  const stored = (await decryptJson<PaymentSecrets>(get("private.payments"))) ?? {};
  const env = process.env;
  // until the owner saves the payments page, live/test follows the old server settings
  if (v.paypal?.live === undefined) pub.paypal.live = env.PAYPAL_ENV === "live";
  if (v.viva?.live === undefined) pub.viva.live = env.VIVA_ENV === "live";
  const secrets: PaymentSecrets = {
    stripeSecretKey: stored.stripeSecretKey || env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: stored.stripeWebhookSecret || env.STRIPE_WEBHOOK_SECRET,
    paypalClientId: stored.paypalClientId || env.PAYPAL_CLIENT_ID,
    paypalSecret: stored.paypalSecret || env.PAYPAL_CLIENT_SECRET,
    vivaClientId: stored.vivaClientId || env.VIVA_CLIENT_ID,
    vivaSecret: stored.vivaSecret || env.VIVA_CLIENT_SECRET,
    vivaSourceCode: stored.vivaSourceCode || env.VIVA_SOURCE_CODE,
  };
  const online: PaymentConfig["online"] = [];
  if (pub.stripe.enabled && secrets.stripeSecretKey) online.push("stripe");
  if (pub.paypal.enabled && secrets.paypalClientId && secrets.paypalSecret) online.push("paypal");
  if (pub.viva.enabled && secrets.vivaClientId && secrets.vivaSecret) online.push("viva");
  const methods: Method[] = [...online];
  if (pub.bank.enabled && pub.bank.iban) methods.push("bank");
  if (pub.cash.enabled) methods.push("cash");
  return { pub, secrets, online, methods };
}

/** Deposit owed online for a cash-on-pickup order, or 0 when none is needed. */
export function depositFor(pub: PaymentPublic, total: number) {
  const d = pub.deposit;
  if (!d.enabled || total < (Number(d.minOrder) || 0)) return 0;
  const amount = Number(d.fixed) > 0 ? Number(d.fixed) : (total * (Number(d.percent) || 0)) / 100;
  return Math.min(total, Math.round(amount * 100) / 100);
}
