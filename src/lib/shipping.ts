import type { CartLine, ShippingMethod } from "./types";

export interface ShippingQuote {
  method: ShippingMethod;
  available: boolean;
  price: number;
  reason?: string;
}

/** Decide which shipping methods apply to a cart and what they cost. */
export function quoteShipping(
  methods: ShippingMethod[],
  lines: CartLine[],
  subtotal: number,
  country = "DE",
  postal = ""
): ShippingQuote[] {
  const weight = lines.reduce((s, l) => s + l.weight_g * l.qty, 0);
  const hasFrozen = lines.some((l) => l.is_frozen);

  return methods
    .filter((m) => m.active && m.type !== "dropship")
    .sort((a, b) => a.sort - b.sort)
    .map((m) => {
      let available = true;
      let reason: string | undefined;
      if (!m.countries.includes(country) && m.type !== "pickup") {
        available = false;
        reason = "Not available for this country";
      }
      if (m.max_weight_g && weight > m.max_weight_g) {
        available = false;
        reason = `Over ${m.max_weight_g / 1000} kg – please choose pickup or split the order`;
      }
      if (subtotal < m.min_order) {
        available = false;
        reason = `Minimum order ${m.min_order.toFixed(2)} €`;
      }
      // Frozen goods travel only by frozen express, local delivery or pickup
      if (hasFrozen && m.type === "parcel") {
        available = false;
        reason = "Your cart contains frozen food – choose frozen express, local delivery or pickup";
      }
      if (m.type === "local" && m.postal_prefixes?.length && postal) {
        if (!m.postal_prefixes.some((p) => postal.startsWith(p))) {
          available = false;
          reason = "Outside our local delivery area";
        }
      }
      const price = m.free_from != null && subtotal >= m.free_from ? 0 : Number(m.price);
      return { method: m, available, price, reason };
    });
}
