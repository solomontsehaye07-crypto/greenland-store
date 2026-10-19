import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { quoteShipping } from "./shipping";
import { round2, vatOf, money } from "./format";
import type { CartLine, ShippingMethod } from "./types";
import { forwardDropshipItems } from "./purchasing";
import { sendEmail } from "./notify";

export const CheckoutSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  name: z.string().min(2).max(120),
  street: z.string().max(160).optional().default(""),
  postal: z.string().max(12).optional().default(""),
  city: z.string().max(80).optional().default(""),
  country: z.string().length(2).default("DE"),
  shipping_code: z.string(),
  pickup_slot: z.string().max(60).optional(),
  payment: z.enum(["stripe", "paypal", "viva", "cash"]),
  notes: z.string().max(500).optional(),
  age_confirmed: z.boolean().optional(),
  items: z.array(z.object({ id: z.number().int(), qty: z.number().int().min(1).max(99) })).min(1),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/** Re-prices the cart from the database (never trusts client prices) and creates a pending order. */
export async function createOrder(input: CheckoutInput, customerId: string | null) {
  const sb = supabaseAdmin();
  const ids = input.items.map((i) => i.id);
  const { data: products } = await sb
    .from("products")
    .select("id, sku, title, slug, price, tax_rate, weight_g, stock, is_frozen, age_restricted, is_dropship, image_url, status")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lines: (CartLine & { tax_rate: number; is_dropship: boolean })[] = [];
  for (const it of input.items) {
    const p = byId.get(it.id);
    if (!p || p.status !== "active") throw new Error("A product in your cart is no longer available.");
    if (!p.is_dropship && p.stock < it.qty) throw new Error(`Only ${p.stock} × ${p.title} left in stock.`);
    lines.push({ ...p, price: Number(p.price), tax_rate: Number(p.tax_rate), qty: it.qty });
  }
  if (lines.some((l) => l.age_restricted) && !input.age_confirmed)
    throw new Error("Please confirm you are 18 or older to buy alcohol.");

  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const { data: methods } = await sb.from("shipping_methods").select("*").eq("active", true);
  const quotes = quoteShipping((methods ?? []) as ShippingMethod[], lines, subtotal, input.country, input.postal);
  const q = quotes.find((x) => x.method.code === input.shipping_code);
  if (!q || !q.available) throw new Error(q?.reason ?? "Please choose a delivery option.");
  if (q.method.type !== "pickup" && (!input.street || !input.postal || !input.city))
    throw new Error("Please enter your delivery address.");
  if (input.payment === "cash" && !["pickup", "local"].includes(q.method.type))
    throw new Error("Cash is only possible for pickup or local delivery.");

  // shipping VAT follows the main rate of the goods (simplified: highest share)
  const tax19 = lines.filter((l) => l.tax_rate === 19).reduce((s, l) => s + l.price * l.qty, 0);
  const shipRate = tax19 > subtotal / 2 ? 19 : 7;
  const tax_total = round2(lines.reduce((s, l) => s + vatOf(l.price * l.qty, l.tax_rate), 0) + vatOf(q.price, shipRate));
  const total = round2(subtotal + q.price);

  const { data: order, error } = await sb
    .from("orders")
    .insert({
      customer_id: customerId,
      email: input.email,
      phone: input.phone,
      status: "pending",
      shipping_method_id: q.method.id,
      fulfillment_type: q.method.type,
      shipping_address:
        q.method.type === "pickup"
          ? { name: input.name }
          : { name: input.name, street: input.street, postal: input.postal, city: input.city, country: input.country },
      pickup_slot: input.pickup_slot ?? null,
      subtotal,
      shipping_total: q.price,
      tax_total,
      total,
      payment_provider: input.payment,
      notes: input.notes ?? null,
    })
    .select("id, number")
    .single();
  if (error || !order) throw new Error("Could not create order. Please try again.");

  await sb.from("order_items").insert(
    lines.map((l) => ({
      order_id: order.id,
      product_id: l.id,
      sku: l.sku,
      title: l.title,
      qty: l.qty,
      unit_price: l.price,
      tax_rate: l.tax_rate,
      is_dropship: l.is_dropship,
    }))
  );
  return { ...order, total, shipping_total: q.price, lines, method: q.method };
}

/** Idempotent: called from webhooks / return URLs once payment is confirmed. */
export async function onOrderPaid(orderId: string, provider: string, ref: string) {
  const sb = supabaseAdmin();
  const { data: changed } = await sb.rpc("mark_order_paid", { p_order_id: orderId, p_provider: provider, p_ref: ref });
  if (!changed) return false;
  await forwardDropshipItems(orderId).catch(() => null);
  await sendConfirmation(orderId).catch(() => null);
  return true;
}

/** Cash orders are confirmed right away but stay unpaid until collected; stock is reserved now. */
export async function confirmCashOrder(orderId: string) {
  const sb = supabaseAdmin();
  await sb.rpc("mark_order_paid", { p_order_id: orderId, p_provider: "cash", p_ref: "pay-on-collection" });
  await sb.from("orders").update({ status: "processing", paid_at: null }).eq("id", orderId);
  await forwardDropshipItems(orderId).catch(() => null);
  await sendConfirmation(orderId).catch(() => null);
}

async function sendConfirmation(orderId: string) {
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("*, order_items(*), shipping_methods(name)").eq("id", orderId).single();
  if (!o) return;
  const rows = (o.order_items as { title: string; qty: number; unit_price: number }[])
    .map((i) => `<tr><td>${i.qty} × ${i.title}</td><td align="right">${money(i.qty * i.unit_price)}</td></tr>`)
    .join("");
  const html = `
    <h2 style="font-family:sans-serif;color:#1D5C3F">Thank you for your order #${o.number}</h2>
    <table style="font-family:sans-serif;font-size:14px" width="100%">${rows}
      <tr><td>${(o.shipping_methods as { name: string } | null)?.name ?? "Shipping"}</td><td align="right">${money(o.shipping_total)}</td></tr>
      <tr><td><b>Total (incl. VAT)</b></td><td align="right"><b>${money(o.total)}</b></td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:13px;color:#555">Questions? Reply to this email or message us on WhatsApp.</p>`;
  await sendEmail({ to: o.email, subject: `Your Greenland order #${o.number}`, html });
  if (process.env.ALERT_EMAIL_TO)
    await sendEmail({ to: process.env.ALERT_EMAIL_TO, subject: `New order #${o.number} – ${money(o.total)}`, html });
}
