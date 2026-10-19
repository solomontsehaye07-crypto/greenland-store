const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export const money = (n: number | string | null | undefined) => eur.format(Number(n ?? 0));

/** German PAngV base price, e.g. "8,98 € / kg" */
export function unitPrice(price: number, qty: number | null, unit: "g" | "ml" | null) {
  if (!qty || !unit || qty <= 0) return null;
  const per = (Number(price) / qty) * 1000;
  return `${money(per)} / ${unit === "g" ? "kg" : "l"}`;
}

export function sizeLabel(qty: number | null, unit: "g" | "ml" | null) {
  if (!qty || !unit) return null;
  if (qty >= 1000) return `${+(qty / 1000).toFixed(2)} ${unit === "g" ? "kg" : "l"}`;
  return `${qty} ${unit}`;
}

/** VAT contained in a gross price */
export const vatOf = (gross: number, rate: number) => Math.round((gross - gross / (1 + rate / 100)) * 100) / 100;

export const round2 = (n: number) => Math.round(n * 100) / 100;
