import "server-only";
import { supabaseAdmin } from "./supabase";
import { PAID_STATUSES } from "./finance";

// Bookkeeping report for the tax advisor (Steuerberater): sales by VAT rate, goods received,
// stock losses (spoiled, damaged, expired, stolen), own use and running costs for a period.

const r2 = (n: number) => Math.round(n * 100) / 100;
const net = (gross: number, rate: number) => gross / (1 + rate / 100);

export interface SaleRow {
  date: string;
  ref: string; // order number or "Kasse"
  channel: "online" | "store";
  payment: string;
  net7: number;
  vat7: number;
  net19: number;
  vat19: number;
  gross: number;
}
export interface StockRow {
  date: string;
  sku: string;
  title: string;
  reason: string;
  qty: number;
  unitCost: number | null;
  value: number | null; // at cost (net)
  note: string;
}
export interface ExpenseRow { date: string; category: string; amount: number; note: string }

export const REASON_DE: Record<string, string> = {
  spoiled: "Verdorben",
  damage: "Beschädigt",
  expired: "Abgelaufen (MHD)",
  theft: "Diebstahl / Schwund",
  own_use: "Eigenverbrauch (Entnahme)",
  purchase: "Wareneingang",
};
export const LOSS = ["spoiled", "damage", "expired", "theft"];

export interface Report {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  sales: SaleRow[];
  salesTotal: { net7: number; vat7: number; net19: number; vat19: number; gross: number; online: number; store: number };
  purchases: StockRow[];
  purchasesTotal: number;
  losses: StockRow[];
  lossesByReason: { reason: string; qty: number; value: number }[];
  ownUse: StockRow[];
  ownUseTotal: number;
  unvalued: number; // loss/own-use lines without a purchase cost
  expenses: ExpenseRow[];
  expensesByCategory: { category: string; amount: number }[];
  expensesTotal: number;
}

export async function buildReport(from: string, to: string): Promise<Report> {
  const sb = supabaseAdmin();
  const f = new Date(`${from}T00:00:00`).toISOString();
  const t = new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString();
  const toEx = t.slice(0, 10);
  const [{ data: orders }, { data: store }, { data: moves }, { data: exp }] = await Promise.all([
    sb
      .from("orders")
      .select("number, created_at, paid_at, status, shipping_total, payment_method, payment_provider, order_items(qty, unit_price, tax_rate)")
      .in("status", PAID_STATUSES)
      .or(`and(paid_at.gte.${f},paid_at.lt.${t}),and(paid_at.is.null,created_at.gte.${f},created_at.lt.${t})`)
      .order("created_at")
      .limit(10000),
    sb.from("store_sales").select("day, gross_7, gross_19, note").gte("day", from).lt("day", toEx).order("day"),
    sb
      .from("stock_movements")
      .select("created_at, qty_change, unit_cost, reason, note, products(sku, title, title_de, cost_price)")
      .in("reason", ["purchase", ...LOSS, "own_use"])
      .gte("created_at", f)
      .lt("created_at", t)
      .order("created_at")
      .limit(20000),
    sb.from("expenses").select("day, category, amount, note").gte("day", from).lt("day", toEx).order("day"),
  ]);

  const sales: SaleRow[] = [];
  for (const o of orders ?? []) {
    const items = (o.order_items ?? []) as { qty: number; unit_price: number; tax_rate: number }[];
    const g7 = items.filter((i) => Number(i.tax_rate) === 7).reduce((s, i) => s + i.qty * Number(i.unit_price), 0);
    const g19 = items.filter((i) => Number(i.tax_rate) === 19).reduce((s, i) => s + i.qty * Number(i.unit_price), 0);
    const ship = Number(o.shipping_total) || 0;
    // shipping follows the main VAT rate of the goods, as at checkout
    const shipRate = g19 > (g7 + g19) / 2 ? 19 : 7;
    const G7 = g7 + (shipRate === 7 ? ship : 0);
    const G19 = g19 + (shipRate === 19 ? ship : 0);
    sales.push({
      date: String(o.paid_at ?? o.created_at).slice(0, 10),
      ref: `#${o.number}`,
      channel: "online",
      payment: String(o.payment_method ?? o.payment_provider ?? ""),
      net7: r2(net(G7, 7)),
      vat7: r2(G7 - net(G7, 7)),
      net19: r2(net(G19, 19)),
      vat19: r2(G19 - net(G19, 19)),
      gross: r2(G7 + G19),
    });
  }
  for (const s of store ?? []) {
    const G7 = Number(s.gross_7) || 0;
    const G19 = Number(s.gross_19) || 0;
    sales.push({ date: s.day, ref: "Kasse", channel: "store", payment: "Kasse", net7: r2(net(G7, 7)), vat7: r2(G7 - net(G7, 7)), net19: r2(net(G19, 19)), vat19: r2(G19 - net(G19, 19)), gross: r2(G7 + G19) });
  }
  sales.sort((a, b) => a.date.localeCompare(b.date));
  const sum = (k: keyof SaleRow, rows = sales) => r2(rows.reduce((s, x) => s + (x[k] as number), 0));

  const row = (m: NonNullable<typeof moves>[number]): StockRow => {
    const p = m.products as unknown as { sku: string; title: string; title_de: string | null; cost_price: number | null } | null;
    const qty = Math.abs(m.qty_change);
    const unit = m.unit_cost != null ? Number(m.unit_cost) : p?.cost_price != null ? Number(p.cost_price) : null;
    return { date: String(m.created_at).slice(0, 10), sku: p?.sku ?? "", title: p?.title_de || p?.title || "", reason: m.reason, qty, unitCost: unit, value: unit != null ? r2(unit * qty) : null, note: m.note ?? "" };
  };
  const purchases = (moves ?? []).filter((m) => m.reason === "purchase").map(row);
  const losses = (moves ?? []).filter((m) => LOSS.includes(m.reason)).map(row);
  const ownUse = (moves ?? []).filter((m) => m.reason === "own_use").map(row);
  const lossesByReason = LOSS.map((reason) => {
    const l = losses.filter((x) => x.reason === reason);
    return { reason, qty: l.reduce((s, x) => s + x.qty, 0), value: r2(l.reduce((s, x) => s + (x.value ?? 0), 0)) };
  }).filter((x) => x.qty > 0);

  const expenses = (exp ?? []).map((e) => ({ date: e.day, category: e.category, amount: Number(e.amount), note: e.note ?? "" }));
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);

  return {
    from,
    to,
    sales,
    salesTotal: {
      net7: sum("net7"),
      vat7: sum("vat7"),
      net19: sum("net19"),
      vat19: sum("vat19"),
      gross: sum("gross"),
      online: sum("gross", sales.filter((s) => s.channel === "online")),
      store: sum("gross", sales.filter((s) => s.channel === "store")),
    },
    purchases,
    purchasesTotal: r2(purchases.reduce((s, x) => s + (x.value ?? 0), 0)),
    losses,
    lossesByReason,
    ownUse,
    ownUseTotal: r2(ownUse.reduce((s, x) => s + (x.value ?? 0), 0)),
    unvalued: [...losses, ...ownUse].filter((x) => x.value === null).length,
    expenses,
    expensesByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount: r2(amount) })).sort((a, b) => b.amount - a.amount),
    expensesTotal: r2(expenses.reduce((s, e) => s + e.amount, 0)),
  };
}

// ---------------- CSV (semicolon, German number format: opens directly in Excel / DATEV import) ----------------

const n = (x: number | null) => (x == null ? "" : x.toFixed(2).replace(".", ","));
// quotes fields and defuses spreadsheet formulas (a value starting with = + - @ would run in Excel)
const esc = (raw: string) => {
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[;"\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function reportCsv(r: Report, part: "sales" | "purchases" | "losses" | "expenses"): string {
  const lines: string[] = [];
  if (part === "sales") {
    lines.push("Datum;Beleg;Kanal;Zahlart;Netto 7%;USt 7%;Netto 19%;USt 19%;Brutto");
    for (const s of r.sales) lines.push([de(s.date), s.ref, s.channel === "online" ? "Onlineshop" : "Ladenkasse", s.payment, n(s.net7), n(s.vat7), n(s.net19), n(s.vat19), n(s.gross)].map((x) => esc(String(x))).join(";"));
    const T = r.salesTotal;
    lines.push(["Summe", "", "", "", n(T.net7), n(T.vat7), n(T.net19), n(T.vat19), n(T.gross)].join(";"));
  } else if (part === "expenses") {
    lines.push("Datum;Kategorie;Betrag;Notiz");
    for (const e of r.expenses) lines.push([de(e.date), e.category, n(e.amount), e.note].map((x) => esc(String(x))).join(";"));
    lines.push(["Summe", "", n(r.expensesTotal), ""].join(";"));
  } else {
    const rows = part === "purchases" ? r.purchases : [...r.losses, ...r.ownUse];
    lines.push("Datum;Art;Artikelnr.;Artikel;Menge;EK netto/Stück;Wert netto;Notiz");
    for (const x of rows) lines.push([de(x.date), REASON_DE[x.reason] ?? x.reason, x.sku, x.title, String(x.qty), n(x.unitCost), n(x.value), x.note].map((v) => esc(String(v))).join(";"));
    const total = rows.reduce((s, x) => s + (x.value ?? 0), 0);
    lines.push(["Summe", "", "", "", String(rows.reduce((s, x) => s + x.qty, 0)), "", n(r2(total)), ""].join(";"));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
