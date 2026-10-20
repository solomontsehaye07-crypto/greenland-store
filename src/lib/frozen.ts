// Frozen packaging: frozen food travels in insulated boxes with cooling packs.
// One box holds up to `boxKg`; every started box costs `boxPrice` for the special packaging.
// Shared by the cart (illustration), the checkout (price) and the server (order total).
// Settings live in settings → public.frozen_pack and are edited under Admin → Shipping & pickup.

import type { L10n } from "./i18n";

export interface FrozenPack {
  enabled: boolean;
  boxKg: number; // capacity of one insulated box
  boxPrice: number; // packaging (box + cooling packs) per started box, gross €
  smallKg: number; // below this frozen weight the customer sees a friendly hint
  perBoxShipping: boolean; // frozen courier price counts per box (each box is its own parcel)
  applyLocal: boolean; // also charge packaging for local delivery
  smallNote: L10n; // optional own wording for the hint
}

export const DEFAULT_FROZEN_PACK: FrozenPack = {
  enabled: true,
  boxKg: 5,
  boxPrice: 7.9,
  smallKg: 1,
  perBoxShipping: true,
  applyLocal: false,
  smallNote: { de: "", en: "" },
};

export function normaliseFrozenPack(v: unknown): FrozenPack {
  const r = { ...DEFAULT_FROZEN_PACK, ...((v ?? {}) as Partial<FrozenPack>) };
  const num = (x: unknown, d: number, min = 0) => (Number.isFinite(Number(x)) && Number(x) >= min ? Number(x) : d);
  return {
    enabled: r.enabled !== false,
    boxKg: num(r.boxKg, 5, 0.5),
    boxPrice: Math.round(num(r.boxPrice, 7.9) * 100) / 100,
    smallKg: num(r.smallKg, 1),
    perBoxShipping: r.perBoxShipping !== false,
    applyLocal: !!r.applyLocal,
    smallNote: { de: r.smallNote?.de ?? "", en: r.smallNote?.en ?? "" },
  };
}

type Weighted = { weight_g: number; qty: number; is_frozen: boolean };

/** Total weight of frozen items in grams. */
export const frozenWeight = (lines: Weighted[]) => lines.reduce((s, l) => s + (l.is_frozen ? (Number(l.weight_g) || 0) * l.qty : 0), 0);

/** Number of boxes needed (0 when there is nothing frozen). */
export function boxCount(weightG: number, pack: FrozenPack) {
  if (weightG <= 0) return 0;
  return Math.max(1, Math.ceil(weightG / (pack.boxKg * 1000)));
}

/** How full each box is, 0–1, e.g. 6.2 kg in 5 kg boxes → [1, 0.24]. */
export function boxFill(weightG: number, pack: FrozenPack) {
  const cap = pack.boxKg * 1000;
  const n = boxCount(weightG, pack);
  return Array.from({ length: n }, (_, i) => Math.min(1, Math.max(0, (weightG - i * cap) / cap)));
}

/** Packaging for one delivery type. Pickup never needs packaging; local only when switched on. */
export function packagingFor(type: string, lines: Weighted[], pack: FrozenPack) {
  const w = frozenWeight(lines);
  const boxes = boxCount(w, pack);
  const applies = pack.enabled && boxes > 0 && (type === "frozen" || (type === "local" && pack.applyLocal));
  return { weightG: w, boxes: applies ? boxes : 0, fee: applies ? Math.round(boxes * pack.boxPrice * 100) / 100 : 0 };
}
