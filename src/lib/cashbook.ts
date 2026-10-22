import "server-only";
import { supabaseAdmin } from "./supabase";

// Two separate books for the Steuerberater:
//  - "shop": the cash book of the shop in Kaiserslautern (Kassenbuch), entered by hand, append-only (GoBD).
//  - "online": the web shop, built automatically from paid, refunded and cancelled orders.
// Both export per month as Excel and as a DATEV booking batch (EXTF, Buchungsstapel).

export type Book = "shop" | "online";

export interface CashEntry {
  id: number;
  seq: number;
  no: string; // "49-10-2026", as in Agenda
  entry_date: string;
  income: number;
  expense: number;
  balance: number;
  text: string;
  bu: string | null;
  contra_account: string | null;
  vat_rate: number | null;
  note: string | null;
  storno_of: number | null;
  stornoed: boolean;
}

export interface ShopMonth {
  year: number;
  month: number;
  opening: number;
  closing: number;
  income: number;
  expense: number;
  closedAt: string | null;
  openingFixed: boolean; // a stored opening balance (not just carried over)
  entries: CashEntry[];
}

export interface OnlineLine {
  date: string;
  kind: "sale" | "refund" | "fee";
  order: number;
  orderId: string;
  method: string;
  gross: number; // + money in, − money out
  net7: number;
  vat7: number;
  net19: number;
  vat19: number;
  text: string;
}

export interface OnlineMonth {
  year: number;
  month: number;
  lines: OnlineLine[];
  sales: number;
  refunds: number;
  fees: number;
  net: number; // sales − refunds − fees
  byMethod: { method: string; amount: number }[];
  vat: { net7: number; vat7: number; net19: number; vat19: number };
  missingFees: number; // card/PayPal payments without a recorded fee
}

export interface AccountingSettings {
  consultant: string; // Beraternummer
  client: string; // Mandantennummer
  chart: "SKR03" | "SKR04";
  cashAccount: string; // Kasse
  revenue7: string;
  revenue19: string;
  transitAccount: string; // money from Stripe/PayPal/bank transfer before it reaches the bank
  feeAccount: string;
}

export const DEFAULT_ACCOUNTING: AccountingSettings = {
  consultant: "",
  client: "30128",
  chart: "SKR03",
  cashAccount: "1600",
  revenue7: "8300",
  revenue19: "8400",
  transitAccount: "1360",
  feeAccount: "4970",
};

export async function getAccountingSettings(): Promise<AccountingSettings> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.accounting").maybeSingle();
  return { ...DEFAULT_ACCOUNTING, ...((data?.value ?? {}) as Partial<AccountingSettings>) };
}

const round = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
export const berlinDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
export const monthKey = (y: number, m: number) => `${y}-${pad(m)}`;

export function parseMonth(v?: string | null): { year: number; month: number } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const m = v?.match(/^(\d{4})-(\d{2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { year: +m[1], month: +m[2] };
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
}

// ---------------- shop cash book ----------------

/** The month's opening balance: the stored one, else the previous month's closing balance (0 for the very first). */
async function openingFor(year: number, month: number): Promise<{ value: number; fixed: boolean; closedAt: string | null }> {
  const sb = supabaseAdmin();
  const { data: row } = await sb.from("cashbook_months").select("opening_balance, closed_at").eq("year", year).eq("month", month).maybeSingle();
  if (row) return { value: Number(row.opening_balance), fixed: true, closedAt: row.closed_at };
  const { data: prev } = await sb
    .from("cashbook_months")
    .select("year, month, opening_balance")
    .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return { value: 0, fixed: false, closedAt: null };
  // carry everything since that month forward
  const { data: sums } = await sb
    .from("cashbook_entries")
    .select("income, expense")
    .or(`year.gt.${prev.year},and(year.eq.${prev.year},month.gte.${prev.month})`)
    .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`);
  const moved = (sums ?? []).reduce((a, e) => a + Number(e.income) - Number(e.expense), 0);
  return { value: round(Number(prev.opening_balance) + moved), fixed: false, closedAt: null };
}

export async function getShopMonth(year: number, month: number): Promise<ShopMonth> {
  const sb = supabaseAdmin();
  const [open, { data }] = await Promise.all([
    openingFor(year, month),
    sb.from("cashbook_entries").select("*").eq("year", year).eq("month", month).order("seq"),
  ]);
  const rows = data ?? [];
  const stornoed = new Set(rows.filter((r) => r.storno_of).map((r) => Number(r.storno_of)));
  let bal = open.value;
  const entries: CashEntry[] = rows.map((r) => {
    bal = round(bal + Number(r.income) - Number(r.expense));
    return {
      id: r.id,
      seq: r.seq,
      no: `${r.seq}-${pad(month)}-${year}`,
      entry_date: r.entry_date,
      income: Number(r.income),
      expense: Number(r.expense),
      balance: bal,
      text: r.text,
      bu: r.bu,
      contra_account: r.contra_account,
      vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
      note: r.note,
      storno_of: r.storno_of,
      stornoed: stornoed.has(r.id),
    };
  });
  const income = round(entries.reduce((a, e) => a + e.income, 0));
  const expense = round(entries.reduce((a, e) => a + e.expense, 0));
  return { year, month, opening: open.value, closing: round(open.value + income - expense), income, expense, closedAt: open.closedAt, openingFixed: open.fixed, entries };
}

// ---------------- online book ----------------

const METHOD: Record<string, string> = {
  stripe: "Karte (Stripe)",
  card: "Karte",
  viva: "Karte (Viva)",
  paypal: "PayPal",
  bank: "Überweisung",
  cash: "Bar bei Abholung",
};
const methodName = (o: { payment_method?: string | null; payment_provider?: string | null }) =>
  METHOD[o.payment_provider ?? ""] ?? METHOD[o.payment_method ?? ""] ?? (o.payment_provider || o.payment_method || "Sonstige");

type OrderRow = {
  id: string;
  number: number;
  status: string;
  total: number;
  paid_at: string | null;
  refunded_at: string | null;
  payment_fee: number | null;
  payment_method: string | null;
  payment_provider: string | null;
  order_items: { qty: number; unit_price: number; tax_rate: number }[];
};

/** Splits an order's total into 7 % and 19 % parts in proportion to its items (shipping and discounts follow the goods). */
function vatSplit(o: OrderRow) {
  const g7 = o.order_items.filter((i) => Number(i.tax_rate) < 10).reduce((a, i) => a + i.qty * Number(i.unit_price), 0);
  const g19 = o.order_items.filter((i) => Number(i.tax_rate) >= 10).reduce((a, i) => a + i.qty * Number(i.unit_price), 0);
  const total = Number(o.total);
  const sum = g7 + g19;
  const t7 = sum > 0 ? round((total * g7) / sum) : 0;
  const t19 = round(total - t7);
  const n7 = round(t7 / 1.07);
  const n19 = round(t19 / 1.19);
  return { net7: n7, vat7: round(t7 - n7), net19: n19, vat19: round(t19 - n19) };
}

export async function getOnlineMonth(year: number, month: number): Promise<OnlineMonth> {
  const sb = supabaseAdmin();
  // a day of margin on both sides; the exact month is decided in Berlin time below
  const from = new Date(Date.UTC(year, month - 1, 1) - 86400000).toISOString();
  const to = new Date(Date.UTC(year, month, 1) + 86400000).toISOString();
  const fields = "id, number, status, total, paid_at, refunded_at, payment_fee, payment_method, payment_provider, order_items(qty, unit_price, tax_rate)";
  const [{ data: paid }, { data: refunded }] = await Promise.all([
    sb.from("orders").select(fields).gte("paid_at", from).lt("paid_at", to).limit(5000),
    sb.from("orders").select(fields).gte("refunded_at", from).lt("refunded_at", to).limit(5000),
  ]);
  const inMonth = (iso: string | null) => !!iso && berlinDay(iso).startsWith(monthKey(year, month));
  const lines: OnlineLine[] = [];
  let missingFees = 0;
  for (const o of (paid ?? []) as unknown as OrderRow[]) {
    if (!inMonth(o.paid_at)) continue;
    const s = vatSplit(o);
    const method = methodName(o);
    lines.push({ date: berlinDay(o.paid_at!), kind: "sale", order: o.number, orderId: o.id, method, gross: Number(o.total), ...s, text: `Bestellung ${o.number}` });
    if (o.payment_fee != null && Number(o.payment_fee) > 0) {
      lines.push({ date: berlinDay(o.paid_at!), kind: "fee", order: o.number, orderId: o.id, method, gross: -Number(o.payment_fee), net7: 0, vat7: 0, net19: 0, vat19: 0, text: `Gebühr ${method} zu Bestellung ${o.number}` });
    } else if (["stripe", "paypal", "viva"].includes(o.payment_provider ?? "")) missingFees++;
  }
  for (const o of (refunded ?? []) as unknown as OrderRow[]) {
    if (!inMonth(o.refunded_at) || !o.paid_at) continue;
    const s = vatSplit(o);
    lines.push({
      date: berlinDay(o.refunded_at!),
      kind: "refund",
      order: o.number,
      orderId: o.id,
      method: methodName(o),
      gross: -Number(o.total),
      net7: -s.net7,
      vat7: -s.vat7,
      net19: -s.net19,
      vat19: -s.vat19,
      text: `${o.status === "cancelled" ? "Storno" : "Erstattung"} Bestellung ${o.number}`,
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const sum = (k: OnlineLine["kind"]) => round(lines.filter((l) => l.kind === k).reduce((a, l) => a + l.gross, 0));
  const sales = sum("sale");
  const refunds = -sum("refund");
  const fees = -sum("fee");
  const byMethod = new Map<string, number>();
  for (const l of lines) if (l.kind !== "fee") byMethod.set(l.method, round((byMethod.get(l.method) ?? 0) + l.gross));
  const vat = lines.reduce((a, l) => ({ net7: a.net7 + l.net7, vat7: a.vat7 + l.vat7, net19: a.net19 + l.net19, vat19: a.vat19 + l.vat19 }), { net7: 0, vat7: 0, net19: 0, vat19: 0 });
  return {
    year,
    month,
    lines,
    sales,
    refunds,
    fees,
    net: round(sales - refunds - fees),
    byMethod: [...byMethod].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    vat: { net7: round(vat.net7), vat7: round(vat.vat7), net19: round(vat.net19), vat19: round(vat.vat19) },
    missingFees,
  };
}

// ---------------- daily overview for the dashboard ----------------

export function dailySeries(shop: ShopMonth, online: OnlineMonth) {
  const days = new Date(Date.UTC(shop.year, shop.month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const d = `${monthKey(shop.year, shop.month)}-${pad(i + 1)}`;
    return {
      day: i + 1,
      date: d,
      shopIn: round(shop.entries.filter((e) => e.entry_date === d).reduce((a, e) => a + e.income, 0)),
      shopOut: round(shop.entries.filter((e) => e.entry_date === d).reduce((a, e) => a + e.expense, 0)),
      online: round(online.lines.filter((l) => l.date === d && l.kind !== "fee").reduce((a, l) => a + l.gross, 0)),
    };
  });
}
