import "server-only";
import { supabaseAdmin } from "./supabase";
import { invoiceTotals, round2, type InvoiceDocInput, type DocKind } from "./invoice-pdf";
import { packSize } from "./purchasing";

// Invoices for business customers (bank transfer). Own number series in public.invoice_series.

export type Series = { prefix: string; next_number: number; pad: number; payment_days: number; footer: string | null };

export async function getSeries(): Promise<Series> {
  const { data } = await supabaseAdmin().from("invoice_series").select("prefix, next_number, pad, payment_days, footer").eq("id", 1).single();
  return (data as Series) ?? { prefix: "RE-", next_number: 1, pad: 4, payment_days: 14, footer: null };
}

export const formatNumber = (s: Pick<Series, "prefix" | "pad">, n: number) => `${s.prefix}${String(n).padStart(s.pad, "0")}`;

/**
 * "Your last invoice number" → prefix, padding and the next number.
 * "RE-2026-0147" → prefix "RE-2026-", pad 4, next 148. "1046" → prefix "", pad 4, next 1047.
 */
export function parseLastNumber(last: string) {
  const m = last.trim().match(/^(.*?)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], pad: m[2].length, next_number: Number(m[2]) + 1 };
}

/** Shop price (gross) → net price for the invoice, with the customer's discount. */
export const netFromGross = (gross: number, rate: number, discountPct = 0) => Math.round((gross / (1 + rate / 100)) * (1 - discountPct / 100) * 10000) / 10000;

/** Saves totals on the invoice after a line change. */
export async function recalc(id: number) {
  const sb = supabaseAdmin();
  const { data: items } = await sb.from("invoice_items").select("qty, unit_net, tax_rate, title").eq("invoice_id", id);
  const t = invoiceTotals((items ?? []).map((i) => ({ ...i, qty: Number(i.qty), unit_net: Number(i.unit_net), tax_rate: Number(i.tax_rate) })));
  await sb.from("invoices").update({ subtotal_net: t.net, vat_total: t.vat, total: t.gross, updated_at: new Date().toISOString() }).eq("id", id);
  return t;
}

export function isOverdue(inv: { status: string; due_date: string | null }) {
  return inv.status === "open" && !!inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10);
}

/** Everything the PDF needs (the PDF itself is built on the device). */
export async function invoiceDocData(id: number, kind: DocKind) {
  const sb = supabaseAdmin();
  const [{ data: inv }, { data: items }, { data: st }, series] = await Promise.all([
    sb.from("invoices").select("*, business_customers(*)").eq("id", id).single(),
    sb.from("invoice_items").select("title, sku, size, qty, unit_net, tax_rate").eq("invoice_id", id).order("position").order("id"),
    sb.from("settings").select("key, value").in("key", ["public.store", "public.receipt", "public.payments"]),
    getSeries(),
  ]);
  if (!inv) throw new Error("Invoice not found");
  const get = (k: string) => ((st ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  const store = get("public.store") as Record<string, string>;
  const receipt = get("public.receipt") as Record<string, string>;
  const bank = ((get("public.payments") as { bank?: InvoiceDocInput["bank"] }).bank ?? null) as InvoiceDocInput["bank"];
  // a draft shows the customer as saved now; an issued invoice keeps the copy from issue time
  const cust = inv.status === "draft" || !inv.customer?.name ? (inv.business_customers ?? {}) : inv.customer;
  const input: InvoiceDocInput = {
    number: inv.number,
    status: inv.status,
    issueDate: inv.issue_date,
    deliveryDate: inv.delivery_date,
    dueDate: inv.due_date,
    paymentDays: inv.payment_days,
    store: { name: store.name ?? "", owner: store.owner, street: store.street, postal: store.postal, city: store.city, phone: store.phone, email: store.email, vat_id: store.vat_id, tax_number: receipt.tax_number },
    customer: cust,
    items: (items ?? []).map((i) => ({ ...i, qty: Number(i.qty), unit_net: Number(i.unit_net), tax_rate: Number(i.tax_rate) })),
    notes: inv.notes,
    footer: series.footer,
    bank: bank?.iban ? bank : null,
    paidAmount: inv.paid_amount != null ? Number(inv.paid_amount) : null,
    reminderNo: (inv.reminders ?? 0) + 1,
  };
  const code = inv.number ?? `Entwurf-${id}`;
  const filename = `${kind === "delivery" ? "Lieferschein" : kind === "reminder" ? "Zahlungserinnerung" : "Rechnung"}-${code}.pdf`;
  const total = invoiceTotals(input.items).gross;
  const open = round2(total - Number(inv.paid_amount ?? 0));
  const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  const hello = `Hallo ${cust.contact_name || cust.name || ""},`.replace(/ ,$/, ",");
  const message =
    kind === "reminder"
      ? `${hello}\n\nanbei eine freundliche Zahlungserinnerung zu unserer Rechnung ${code} über ${eur(open)}. Vielen Dank!\n\n${store.name ?? ""}`
      : kind === "delivery"
        ? `${hello}\n\nanbei der Lieferschein zu ${code}.\n\n${store.name ?? ""}`
        : `${hello}\n\nanbei unsere Rechnung ${code} über ${eur(total)}, zahlbar bis ${inv.due_date ? inv.due_date.split("-").reverse().join(".") : "-"}. Vielen Dank für Ihren Auftrag!\n\n${store.name ?? ""}`;
  return { input, filename, message };
}

/** Product → invoice line (net price from the shop price, minus the customer's discount). */
export async function lineFromProduct(productId: number, discountPct: number) {
  const { data: p } = await supabaseAdmin().from("products").select("id, sku, title, title_de, price, tax_rate, size_qty, size_unit").eq("id", productId).single();
  if (!p) throw new Error("Product not found");
  const rate = Number(p.tax_rate ?? 7);
  const { size, title } = packSize(p.title_de || p.title, p.size_qty, p.size_unit);
  return { product_id: p.id, sku: p.sku, title, size, tax_rate: rate, unit_net: netFromGross(Number(p.price ?? 0), rate, discountPct) };
}
