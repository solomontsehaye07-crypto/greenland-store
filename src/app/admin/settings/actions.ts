"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptJson, DEFAULT_PAYMENTS, DEFAULT_PICKUP, encryptJson, type PaymentPublic, type PaymentSecrets, type PickupSettings, type Window } from "@/lib/commerce";

const txt = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const dec = (v: FormDataEntryValue | null) => {
  const s = txt(v).replace(/\s|€/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
};
const on = (fd: FormData, k: string) => fd.get(k) === "on";

function back(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}

async function upsert(key: string, value: unknown) {
  const { error } = await supabaseAdmin().from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// ---------------- shipping methods ----------------

const TYPES = ["parcel", "frozen", "local", "pickup", "dropship"];

export async function saveShippingMethod(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(fd.get("id")) || null;
  const type = txt(fd.get("type"));
  if (!TYPES.includes(type)) back("/admin/settings/shipping", "Please choose a type.");
  const name = txt(fd.get("name"));
  if (!name) back(`/admin/settings/shipping?edit=${id ?? "new"}`, "Please enter a name.");
  const row = {
    name,
    name_de: txt(fd.get("name_de")) || null,
    description: txt(fd.get("description")) || null,
    description_de: txt(fd.get("description_de")) || null,
    type,
    carrier: txt(fd.get("carrier")) || null,
    tracking_url: txt(fd.get("tracking_url")) || null,
    eta: txt(fd.get("eta")) || null,
    price: dec(fd.get("price")) ?? 0,
    free_from: dec(fd.get("free_from")),
    min_order: dec(fd.get("min_order")) ?? 0,
    max_weight_g: Math.round((dec(fd.get("max_weight_kg")) ?? 0) * 1000) || null,
    countries: txt(fd.get("countries")).toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c)),
    postal_prefixes: txt(fd.get("postal_prefixes")).split(/[\s,]+/).filter(Boolean),
    active: on(fd, "active"),
    sort: Number(fd.get("sort")) || 0,
  };
  if (!row.countries.length) row.countries = ["DE"];
  const sb = supabaseAdmin();
  if (id) {
    const { error } = await sb.from("shipping_methods").update(row).eq("id", id);
    if (error) back(`/admin/settings/shipping?edit=${id}`, `Could not save: ${error.message}`);
  } else {
    const code = `${type}-${Date.now().toString(36)}`;
    const { error } = await sb.from("shipping_methods").insert({ ...row, code });
    if (error) back("/admin/settings/shipping?edit=new", `Could not save: ${error.message}`);
  }
  revalidatePath("/", "layout");
  back("/admin/settings/shipping", "Delivery option saved.");
}

export async function toggleShippingMethod(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  await supabaseAdmin().from("shipping_methods").update({ active: fd.get("active") === "true" }).eq("id", Number(fd.get("id")));
  revalidatePath("/", "layout");
  back("/admin/settings/shipping", fd.get("active") === "true" ? "Delivery option switched on." : "Delivery option switched off.");
}

// ---------------- pickup ----------------

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function savePickup(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const days = {} as PickupSettings["days"];
  for (const d of DAYS) {
    const ws: Window[] = [];
    if (on(fd, `${d}_open`)) {
      for (const n of [1, 2]) {
        const from = txt(fd.get(`${d}_from${n}`));
        const to = txt(fd.get(`${d}_to${n}`));
        if (TIME.test(from) && TIME.test(to) && from < to) ws.push({ from, to });
      }
    }
    days[d] = ws;
  }
  const closed = txt(fd.get("closed"))
    .split(/[\s,]+/)
    .map((s) => {
      const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
    })
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  const value: PickupSettings = {
    ...DEFAULT_PICKUP,
    slotMinutes: Math.min(Math.max(Number(fd.get("slotMinutes")) || 60, 15), 480),
    leadHours: Math.max(Number(fd.get("leadHours")) || 0, 0),
    daysAhead: Math.min(Math.max(Number(fd.get("daysAhead")) || 7, 1), 60),
    capacity: Math.max(Number(fd.get("capacity")) || 0, 0),
    days,
    closed,
    address: { de: txt(fd.get("address_de")), en: txt(fd.get("address_en")) },
    note: { de: txt(fd.get("note_de")), en: txt(fd.get("note_en")) },
    allowAsap: on(fd, "allowAsap"),
  };
  await upsert("public.pickup", value);
  revalidatePath("/checkout");
  back("/admin/settings/shipping", "Pickup times saved. Checkout shows them now.");
}

// ---------------- DHL connection ----------------

export async function saveDhlSettings(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const { getDhl, saveDhl, testDhl } = await import("@/lib/dhl");
  const c = await getDhl();
  for (const k of ["apiKey", "user", "password"] as const) {
    const v = txt(fd.get(k));
    if (fd.get(`${k}__clear`) === "on") delete c[k];
    else if (v) c[k] = v;
  }
  const fmt = txt(fd.get("printFormat"));
  const next = {
    ...c,
    enabled: on(fd, "enabled"),
    sandbox: on(fd, "sandbox"),
    billingNumber: txt(fd.get("billingNumber")).replace(/\s/g, ""),
    printFormat: (["A4", "910-300-700", "910-300-600", "910-300-300"].includes(fmt) ? fmt : "910-300-700") as typeof c.printFormat,
    auto: on(fd, "auto"),
    shareEmail: on(fd, "shareEmail"),
    extraWeightKg: Math.min(5, Math.max(0, dec(fd.get("extraWeightKg")) ?? 0.3)),
    sender: {
      name1: txt(fd.get("s_name1")),
      name2: txt(fd.get("s_name2")),
      street: txt(fd.get("s_street")),
      house: txt(fd.get("s_house")),
      postal: txt(fd.get("s_postal")),
      city: txt(fd.get("s_city")),
      email: txt(fd.get("s_email")),
    },
  };
  await saveDhl(next);
  let msg = "DHL settings saved.";
  if (fd.get("test") === "1") {
    try {
      await testDhl(next);
      msg = `DHL connection works${next.sandbox ? " (test mode)" : ""}.`;
    } catch (e) {
      msg = `Saved, but DHL said: ${(e as Error).message}`;
    }
  }
  revalidatePath("/admin/settings/shipping");
  back("/admin/settings/shipping", msg);
}

// ---------------- delivery area ----------------

export async function saveShippingArea(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const abroad = on(fd, "abroad");
  await upsert("public.shipping_area", { abroad });
  revalidatePath("/", "layout");
  back("/admin/settings/shipping", abroad ? "Delivery abroad is switched on." : "Delivery is now limited to Germany.");
}

// ---------------- frozen packaging ----------------

export async function saveFrozenPack(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const boxKg = dec(fd.get("boxKg"));
  const boxPrice = dec(fd.get("boxPrice"));
  if (!boxKg || boxKg < 0.5) back("/admin/settings/shipping", "Box size must be at least 0.5 kg.");
  if (boxPrice == null || boxPrice < 0) back("/admin/settings/shipping", "Please enter the packaging price per box.");
  await upsert("public.frozen_pack", {
    enabled: on(fd, "enabled"),
    boxKg,
    boxPrice: Math.round(boxPrice * 100) / 100,
    smallKg: Math.max(0, dec(fd.get("smallKg")) ?? 1),
    perBoxShipping: on(fd, "perBoxShipping"),
    applyLocal: on(fd, "applyLocal"),
    smallNote: { de: txt(fd.get("small_de")), en: txt(fd.get("small_en")) },
  });
  revalidatePath("/", "layout");
  back("/admin/settings/shipping", "Frozen packaging saved. Cart and checkout use it now.");
}

// ---------------- payments ----------------

const SECRET_FIELDS: (keyof PaymentSecrets)[] = ["stripeSecretKey", "stripeWebhookSecret", "paypalClientId", "paypalSecret", "vivaClientId", "vivaSecret", "vivaSourceCode"];

export async function savePayments(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("key, value").in("key", ["public.payments", "private.payments"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  const old = { ...DEFAULT_PAYMENTS, ...((get("public.payments") ?? {}) as Partial<PaymentPublic>) };
  const label = (k: string, d: { de?: string; en?: string }) => ({ de: txt(fd.get(`${k}_label_de`)) || d.de || "", en: txt(fd.get(`${k}_label_en`)) || d.en || "" });

  const pub: PaymentPublic = {
    stripe: { enabled: on(fd, "stripe_enabled"), live: fd.get("stripe_mode") !== "test", label: label("stripe", DEFAULT_PAYMENTS.stripe.label) },
    paypal: { enabled: on(fd, "paypal_enabled"), live: fd.get("paypal_mode") !== "test", label: label("paypal", DEFAULT_PAYMENTS.paypal.label) },
    viva: { enabled: on(fd, "viva_enabled"), live: fd.get("viva_mode") !== "test", label: label("viva", DEFAULT_PAYMENTS.viva.label) },
    bank: {
      enabled: on(fd, "bank_enabled"),
      label: label("bank", DEFAULT_PAYMENTS.bank.label),
      holder: txt(fd.get("bank_holder")),
      iban: txt(fd.get("bank_iban")).replace(/\s+/g, " ").toUpperCase(),
      bic: txt(fd.get("bank_bic")).toUpperCase(),
      bankName: txt(fd.get("bank_name")),
      days: Math.max(Number(fd.get("bank_days")) || 7, 1),
    },
    cash: { enabled: on(fd, "cash_enabled"), pickup: on(fd, "cash_pickup"), local: on(fd, "cash_local"), label: label("cash", DEFAULT_PAYMENTS.cash.label) },
    deposit: {
      enabled: on(fd, "deposit_enabled"),
      required: true,
      percent: Math.min(Math.max(dec(fd.get("deposit_percent")) ?? 0, 0), 100),
      fixed: Math.max(dec(fd.get("deposit_fixed")) ?? 0, 0),
      minOrder: Math.max(dec(fd.get("deposit_min")) ?? 0, 0),
    },
  };
  if (pub.bank.enabled && !pub.bank.iban) back("/admin/settings/payments", "Enter the IBAN to offer bank transfer, or switch bank transfer off.");
  void old;

  // keys: an empty field keeps the stored key; "remove" ticks clear it
  const secrets = ((await decryptJson<PaymentSecrets>(get("private.payments"))) ?? {}) as PaymentSecrets;
  for (const k of SECRET_FIELDS) {
    const v = txt(fd.get(k));
    if (fd.get(`${k}__clear`) === "on") delete secrets[k];
    else if (v) secrets[k] = v;
  }
  await upsert("public.payments", pub);
  await upsert("private.payments", await encryptJson(secrets));
  revalidatePath("/checkout");
  back("/admin/settings/payments", "Payment settings saved. Checkout uses them now.");
}

// ---------------- receipts, store details, email ----------------

export async function saveReceiptSettings(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const store = Object.fromEntries(["name", "owner", "street", "postal", "city", "phone", "whatsapp", "email", "vat_id"].map((k) => [k, txt(fd.get(k))]));
  const receipt = { title: txt(fd.get("receipt_title")), tax_number: txt(fd.get("tax_number")), footer: txt(fd.get("receipt_footer")) };
  await upsert("public.store", store);
  await upsert("public.receipt", receipt);

  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("value").eq("key", "private.email").maybeSingle();
  const mail = ((await decryptJson<{ resendKey?: string; from?: string; alertTo?: string }>(data?.value)) ?? {}) as { resendKey?: string; from?: string; alertTo?: string };
  const key = txt(fd.get("resendKey"));
  if (fd.get("resendKey__clear") === "on") delete mail.resendKey;
  else if (key) mail.resendKey = key;
  mail.from = txt(fd.get("email_from")) || undefined;
  mail.alertTo = txt(fd.get("alert_to")) || undefined;
  await upsert("private.email", await encryptJson(mail));
  revalidatePath("/admin/settings");
  back("/admin/settings", "Saved.");
}
