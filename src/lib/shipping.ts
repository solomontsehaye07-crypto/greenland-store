import type { CartLine, ShippingMethod } from "./types";
import { packagingFor, type FrozenPack } from "./frozen";

export interface ShippingQuote {
  method: ShippingMethod;
  available: boolean;
  /** delivery + frozen packaging */
  price: number;
  /** delivery part of the price */
  delivery: number;
  /** frozen packaging part of the price */
  packaging: { boxes: number; fee: number };
  reason?: string;
}

/** Decide which shipping methods apply to a cart and what they cost. */
export function quoteShipping(
  methods: ShippingMethod[],
  lines: CartLine[],
  subtotal: number,
  country = "DE",
  postal = "",
  pack?: FrozenPack,
  /** km from the shop to the delivery address: undefined = not checked yet, null = address not found */
  distanceKm?: number | null
): ShippingQuote[] {
  const weight = lines.reduce((s, l) => s + l.weight_g * l.qty, 0);
  const hasFrozen = lines.some((l) => l.is_frozen);

  return methods
    // the frozen express only makes sense for carts with frozen food
    .filter((m) => m.active && m.type !== "dropship" && (m.type !== "frozen" || hasFrozen))
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
      // Frozen goods travel only by frozen express (when switched on), local delivery or pickup
      if (hasFrozen && m.type === "parcel") {
        available = false;
        reason = methods.some((x) => x.active && x.type === "frozen")
          ? "Your cart has frozen food – please choose frozen express, local delivery or pickup"
          : "Frozen food only by pickup or local delivery";
      }
      const radius = Number(m.max_distance_km) || 0;
      if (m.type === "local" && radius > 0) {
        if (distanceKm === undefined) {
          available = false;
          reason = `Enter your address – we deliver within ${radius} km of our shop`;
        } else if (distanceKm === null) {
          available = false;
          reason = "We could not find this address – please check it or choose pickup";
        } else if (distanceKm > radius) {
          available = false;
          reason = `${distanceKm.toLocaleString("de-DE")} km away – local delivery only within ${radius} km`;
        }
      }
      if (m.type === "local" && !radius && m.postal_prefixes?.length && postal) {
        if (!m.postal_prefixes.some((p) => postal.startsWith(p))) {
          available = false;
          reason = "Outside our local delivery area";
        }
      }
      const packaging = pack ? packagingFor(m.type, lines, pack) : { boxes: 0, fee: 0 };
      // each insulated box travels as its own parcel when the frozen courier charges per box
      const parcels = m.type === "frozen" && pack?.perBoxShipping && packaging.boxes > 1 ? packaging.boxes : 1;
      const delivery = m.free_from != null && subtotal >= m.free_from ? 0 : Math.round(Number(m.price) * parcels * 100) / 100;
      const price = Math.round((delivery + packaging.fee) * 100) / 100;
      return { method: m, available, price, delivery, packaging: { boxes: packaging.boxes, fee: packaging.fee }, reason };
    });
}
