// Quantity discounts ("ab 3 Stück 5 %"). Pure functions, used by the cart, the checkout page and createOrder
// so all three always show and charge the same price.

export type Tier = { min: number; pct: number };
export type TierConfig = { enabled: boolean; tiers: Tier[] };

export const DEFAULT_TIERS: TierConfig = {
  enabled: true,
  tiers: [
    { min: 3, pct: 5 },
    { min: 5, pct: 10 },
    { min: 10, pct: 15 },
  ],
};

/** Percentage for this quantity (0 when no tier applies). */
export function tierPct(qty: number, cfg: TierConfig | null | undefined, eligible = true): number {
  if (!cfg?.enabled || !eligible) return 0;
  let pct = 0;
  for (const t of cfg.tiers) if (qty >= t.min && t.pct > pct) pct = t.pct;
  return pct;
}

/** Unit price after a percentage, rounded down to the cent (same rule as discount codes). */
export const discounted = (unit: number, pct: number) => (pct > 0 ? Math.floor(unit * (1 - pct / 100) * 100 + 1e-6) / 100 : unit);

/**
 * Price per unit for a cart line. A discount code and the quantity discount do not stack:
 * per line the bigger of the two percentages is used.
 */
export function lineUnit(unit: number, qty: number, cfg: TierConfig | null | undefined, eligible = true, couponPct = 0) {
  const t = tierPct(qty, cfg, eligible);
  const pct = Math.max(t, couponPct);
  return { unit: discounted(unit, pct), pct, source: pct === 0 ? null : t >= couponPct ? ("tier" as const) : ("coupon" as const) };
}

export function sanitizeTiers(v: unknown): TierConfig {
  const o = (v ?? {}) as Partial<TierConfig>;
  const tiers = (Array.isArray(o.tiers) ? o.tiers : DEFAULT_TIERS.tiers)
    .map((t) => ({ min: Math.round(Number(t?.min)), pct: Number(t?.pct) }))
    .filter((t) => t.min >= 2 && t.pct > 0 && t.pct < 90)
    .sort((a, b) => a.min - b.min);
  return { enabled: o.enabled !== false, tiers };
}
