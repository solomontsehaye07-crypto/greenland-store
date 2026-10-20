import "server-only";
import { supabaseAdmin } from "./supabase";

export const PAID_STATUSES = ["paid", "processing", "packed", "shipped", "ready_for_pickup", "delivered"];
export const LOSS_REASONS = ["damage", "expired", "spoiled", "theft"] as const;
export const EXPENSE_CATEGORIES = ["Rent", "Staff", "Energy", "Packaging", "Shipping", "Marketing", "Fees & software", "Insurance", "Other"];

type Move = { qty_change: number; unit_cost: number | null; reason: string; product_id: number; products: { title: string; title_de: string | null; category_id: number | null } | null };

export interface Pnl {
  from: Date;
  to: Date;
  revenueOnline: number; // net of VAT
  revenueStore: number; // net of VAT
  revenue: number;
  cogs: number; // cost of goods that left through sales and stock counts
  writeoffs: number; // spoiled, damaged, expired at cost
  purchases: number; // goods received at cost
  grossProfit: number;
  grossMargin: number | null; // % of revenue
  expenses: number;
  expensesByCategory: { label: string; value: number }[];
  netProfit: number;
  netMargin: number | null;
  lossRate: number | null; // write-offs / purchases, %
  uncosted: number; // movements without a cost
  lossByCategory: { category_id: number; purchases: number; writeoffs: number; rate: number | null }[];
  topLosses: { product_id: number; title: string; qty: number; value: number; reasons: string }[];
  orders: number;
}

type Rows = {
  orders: { total: number; tax_total: number; status: string; paid_at: string }[];
  store: { day: string; gross_7: number; gross_19: number }[];
  exp: { day: string; category: string; amount: number }[];
  moves: (Move & { created_at: string })[];
};

async function fetchRows(from: Date, to: Date): Promise<Rows> {
  const sb = supabaseAdmin();
  const f = from.toISOString();
  const t = to.toISOString();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const [{ data: orders }, { data: store }, { data: exp }, { data: moves }] = await Promise.all([
    sb.from("orders").select("total, tax_total, status, paid_at").gte("paid_at", f).lt("paid_at", t).in("status", PAID_STATUSES),
    sb.from("store_sales").select("day, gross_7, gross_19").gte("day", day(from)).lt("day", day(to)),
    sb.from("expenses").select("day, category, amount").gte("day", day(from)).lt("day", day(to)),
    sb
      .from("stock_movements")
      .select("qty_change, unit_cost, reason, product_id, created_at, products(title, title_de, category_id)")
      .gte("created_at", f)
      .lt("created_at", t)
      .in("reason", ["purchase", "sale", "return", "adjustment", ...LOSS_REASONS])
      .not("unit_cost", "is", null)
      .limit(50000),
  ]);
  return { orders: (orders ?? []) as Rows["orders"], store: (store ?? []) as Rows["store"], exp: (exp ?? []) as Rows["exp"], moves: (moves ?? []) as unknown as Rows["moves"] };
}

export async function computePnl(from: Date, to: Date): Promise<Pnl> {
  return compute(await fetchRows(from, to), from, to);
}

/** Several periods (e.g. the last six months) from a single database read. */
export async function computePnlSeries(ranges: { from: Date; to: Date }[]): Promise<Pnl[]> {
  if (!ranges.length) return [];
  const min = new Date(Math.min(...ranges.map((r) => r.from.getTime())));
  const max = new Date(Math.max(...ranges.map((r) => r.to.getTime())));
  const rows = await fetchRows(min, max);
  return ranges.map((r) => compute(rows, r.from, r.to));
}

function compute(all: Rows, from: Date, to: Date): Pnl {
  const f = from.toISOString();
  const t = to.toISOString();
  const d0 = f.slice(0, 10);
  const d1 = t.slice(0, 10);
  const orders = all.orders.filter((o) => o.paid_at >= f && o.paid_at < t);
  const store = all.store.filter((x) => x.day >= d0 && x.day < d1);
  const exp = all.exp.filter((x) => x.day >= d0 && x.day < d1);
  const moves = all.moves.filter((m) => m.created_at >= f && m.created_at < t);

  const revenueOnline = orders.reduce((a, o) => a + Number(o.total) - Number(o.tax_total ?? 0), 0);
  const revenueStore = store.reduce((a, s) => a + Number(s.gross_7) / 1.07 + Number(s.gross_19) / 1.19, 0);
  const revenue = revenueOnline + revenueStore;

  let cogs = 0, writeoffs = 0, purchases = 0, uncosted = 0;
  const byCat = new Map<number, { purchases: number; writeoffs: number }>();
  const byProd = new Map<number, { title: string; qty: number; value: number; reasons: Set<string> }>();
  for (const m of moves) {
    if (m.unit_cost === null) { uncosted++; continue; }
    const v = m.qty_change * Number(m.unit_cost);
    const cid = m.products?.category_id ?? 0;
    const c = byCat.get(cid) ?? { purchases: 0, writeoffs: 0 };
    if (m.reason === "purchase") { purchases += v; c.purchases += v; }
    else if ((LOSS_REASONS as readonly string[]).includes(m.reason)) {
      writeoffs += -v;
      c.writeoffs += -v;
      const p = byProd.get(m.product_id) ?? { title: m.products?.title_de || m.products?.title || `#${m.product_id}`, qty: 0, value: 0, reasons: new Set<string>() };
      p.qty += -m.qty_change; p.value += -v; p.reasons.add(m.reason);
      byProd.set(m.product_id, p);
    } else cogs += -v;
    byCat.set(cid, c);
  }

  const expensesMap = new Map<string, number>();
  for (const e of exp) expensesMap.set(e.category, (expensesMap.get(e.category) ?? 0) + Number(e.amount));
  const expenses = [...expensesMap.values()].reduce((a, b) => a + b, 0);
  const grossProfit = revenue - cogs - writeoffs;
  const netProfit = grossProfit - expenses;
  return {
    from, to, revenueOnline, revenueStore, revenue, cogs, writeoffs, purchases, grossProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    expenses,
    expensesByCategory: [...expensesMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : null,
    lossRate: purchases > 0 ? (writeoffs / purchases) * 100 : null,
    uncosted,
    lossByCategory: [...byCat.entries()]
      .filter(([, c]) => c.purchases > 0 || c.writeoffs > 0)
      .map(([category_id, c]) => ({ category_id, ...c, rate: c.purchases > 0 ? (c.writeoffs / c.purchases) * 100 : null }))
      .sort((a, b) => b.writeoffs - a.writeoffs),
    topLosses: [...byProd.entries()]
      .map(([product_id, p]) => ({ product_id, title: p.title, qty: p.qty, value: p.value, reasons: [...p.reasons].join(", ") }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    orders: orders.length,
  };
}

/** Month boundaries in local time for "YYYY-MM", or the current month. */
export function monthRange(m?: string) {
  const now = new Date();
  const [y, mo] = m && /^\d{4}-\d{2}$/.test(m) ? m.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(Date.UTC(y, mo - 1, 1));
  const to = new Date(Date.UTC(y, mo, 1));
  return { from, to, key: `${y}-${String(mo).padStart(2, "0")}` };
}
