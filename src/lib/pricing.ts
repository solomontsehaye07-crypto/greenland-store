import "server-only";
import { supabaseAdmin } from "./supabase";

/** Target margin and waste allowance, both in percent. */
export type Rule = { margin: number; waste: number };

export interface PricingSettings {
  autoApply: boolean;
  useMeasuredLoss: boolean;
  rounding: "psych" | "cent";
  default: Rule;
  departments: Record<string, Rule>;
  categories: Record<string, Rule>;
}

export const DEFAULT_PRICING: PricingSettings = {
  autoApply: false,
  useMeasuredLoss: false,
  rounding: "psych",
  default: { margin: 30, waste: 2 },
  departments: { food: { margin: 30, waste: 2 }, beauty: { margin: 40, waste: 1 }, home: { margin: 45, waste: 0 } },
  categories: { "2": { margin: 35, waste: 12 }, "3": { margin: 30, waste: 3 } },
};

export type Cat = { id: number; title: string; department: string | null; parent_id: number | null };

export async function getPricingSettings(): Promise<PricingSettings> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "admin.pricing").maybeSingle();
  const v = (data?.value ?? {}) as Partial<PricingSettings>;
  return {
    ...DEFAULT_PRICING,
    ...v,
    default: { ...DEFAULT_PRICING.default, ...(v.default ?? {}) },
    departments: { ...DEFAULT_PRICING.departments, ...(v.departments ?? {}) },
    categories: { ...(v.categories ?? DEFAULT_PRICING.categories) },
  };
}

/** The rule for a product: its category's override, then the parent category's, then the department's, then the default.
 *  With "use measured loss" on, the waste allowance comes from real write-offs when there is enough data. */
export function ruleFor(s: PricingSettings, categoryId: number | null, cats: Cat[], measured?: Map<number, number>): Rule & { from: string } {
  const c = cats.find((x) => x.id === categoryId);
  const parent = c?.parent_id ? cats.find((x) => x.id === c.parent_id) : undefined;
  let base: Rule & { from: string } = { ...s.default, from: "default" };
  const dept = c?.department ?? parent?.department;
  if (dept && s.departments[dept]) base = { ...s.departments[dept], from: dept };
  if (parent && s.categories[String(parent.id)]) base = { ...s.categories[String(parent.id)], from: parent.title };
  if (c && s.categories[String(c.id)]) base = { ...s.categories[String(c.id)], from: c.title };
  if (s.useMeasuredLoss && c && measured?.has(c.id)) base = { ...base, waste: Math.round(measured.get(c.id)! * 10) / 10, from: `${base.from}, measured loss` };
  return base;
}

/** Round a gross price up to a shop-style ending: x.49 or x.99 below 50 €, x.99 above. */
export function roundPrice(gross: number, mode: PricingSettings["rounding"] = "psych") {
  if (mode === "cent") return Math.ceil(gross * 100) / 100;
  const whole = Math.floor(gross);
  const endings = gross < 50 ? [0.49, 0.99] : [0.99];
  for (let w = whole; w <= whole + 1; w++) for (const e of endings) if (w + e >= gross - 0.001) return Math.round((w + e) * 100) / 100;
  return Math.round(gross * 100) / 100;
}

/** Recommended gross selling price from net purchase cost, VAT, waste allowance and target margin on the net price. */
export function recommendPrice(cost: number, taxRate: number, rule: Rule, mode: PricingSettings["rounding"] = "psych") {
  const m = Math.min(Math.max(rule.margin, 0), 90) / 100;
  const effectiveCost = cost * (1 + Math.max(rule.waste, 0) / 100);
  const net = effectiveCost / (1 - m);
  return roundPrice(net * (1 + taxRate / 100), mode);
}

/** Margin on the net price after the waste allowance, in percent. */
export function marginOf(grossPrice: number, taxRate: number, cost: number, wastePct = 0) {
  const net = grossPrice / (1 + taxRate / 100);
  if (net <= 0) return 0;
  return ((net - cost * (1 + wastePct / 100)) / net) * 100;
}

/** Real loss rate per category over the last `days`: write-offs at cost divided by purchases at cost, in percent. */
export async function measuredLossByCategory(days = 90): Promise<Map<number, number>> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabaseAdmin()
    .from("stock_movements")
    .select("qty_change, unit_cost, reason, products!inner(category_id)")
    .in("reason", ["purchase", "damage", "expired", "spoiled", "theft"])
    .gte("created_at", since)
    .not("unit_cost", "is", null)
    .limit(20000);
  const buy = new Map<number, number>();
  const lost = new Map<number, number>();
  for (const r of (data ?? []) as unknown as { qty_change: number; unit_cost: number; reason: string; products: { category_id: number | null } }[]) {
    const cid = r.products?.category_id;
    if (!cid) continue;
    const v = Math.abs(r.qty_change) * Number(r.unit_cost);
    const m = r.reason === "purchase" ? buy : lost;
    m.set(cid, (m.get(cid) ?? 0) + v);
  }
  const out = new Map<number, number>();
  for (const [cid, b] of buy) if (b >= 50) out.set(cid, ((lost.get(cid) ?? 0) / b) * 100);
  return out;
}

/** Set products to their recommended price and log every change. Returns how many prices changed. */
export async function applyRecommended(ids: number[], userId: string | null, source = "pricing tool") {
  if (!ids.length) return 0;
  const sb = supabaseAdmin();
  const [s, { data: cats }, { data: prods }] = await Promise.all([
    getPricingSettings(),
    sb.from("categories").select("id, title, department, parent_id"),
    sb.from("products").select("id, price, cost_price, tax_rate, category_id").in("id", ids),
  ]);
  const measured = s.useMeasuredLoss ? await measuredLossByCategory() : undefined;
  let changed = 0;
  for (const p of prods ?? []) {
    if (p.cost_price == null || Number(p.cost_price) <= 0) continue;
    const rule = ruleFor(s, p.category_id, (cats ?? []) as Cat[], measured);
    const next = recommendPrice(Number(p.cost_price), Number(p.tax_rate), rule, s.rounding);
    if (Math.abs(next - Number(p.price)) < 0.005) continue;
    const { error } = await sb.from("products").update({ price: next, price_source: source }).eq("id", p.id);
    if (error) continue;
    await sb.from("price_changes").insert({ product_id: p.id, old_price: p.price, new_price: next, cost_price: p.cost_price, source, created_by: userId });
    changed++;
  }
  return changed;
}
