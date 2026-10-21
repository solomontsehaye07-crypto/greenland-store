import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { quoteShipping } from "./shipping";
import { round2, vatOf, money } from "./format";
import type { CartLine, ShippingMethod } from "./types";
import { forwardDropshipItems } from "./purchasing";
import { emailConfig, sendEmail } from "./notify";
import { depositFor, getFrozenPack, getPaymentConfig, getShippingArea, pickupSlots, type PaymentConfig } from "./commerce";
import { buildReceiptPdf } from "./pdf";
import { esc, siteUrl } from "./site";
import { checkCoupon, consumeCoupon } from "./coupons";

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
  pickup_at: z.string().max(40).optional(),
  payment: z.enum(["stripe", "paypal", "viva", "bank", "cash"]),
  deposit_provider: z.enum(["stripe", "paypal", "viva"]).optional(),
  notes: z.string().max(500).optional(),
  age_confirmed: z.boolean().optional(),
  items: z.array(z.object({ id: z.number().int(), qty: z.number().int().min(1).max(99) })).min(1),
  coupon: z.string().max(40).optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/** Re-prices the cart from the database (never trusts client prices) and creates a pending order. */
export async function createOrder(input: CheckoutInput, customerId: string | null, cfg?: PaymentConfig) {
  const sb = supabaseAdmin();
  cfg = cfg ?? (await getPaymentConfig());
  if (!cfg.methods.includes(input.payment)) throw new Error("This payment method is not available.");
  // abuse guard: unpaid orders (cash / bank) reserve stock, so one email may only have a few open at a time
  if (input.payment === "cash" || input.payment === "bank") {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).ilike("email", input.email.trim()).in("status", ["pending", "processing"]).gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("You already have open orders waiting for payment or pickup. Please complete those first or contact us.");
  }
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

  // discount code: the percentage is taken off every unit price (rounded down to the cent), so VAT,
  // receipts and the payment provider all see the same, already reduced prices
  const listSubtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  let couponCode: string | null = null;
  if (input.coupon?.trim()) {
    const chk = await checkCoupon(input.coupon, input.email, listSubtotal);
    if (!chk.ok) throw new Error(chk.reason);
    couponCode = chk.code;
    for (const l of lines) l.price = Math.floor(l.price * (1 - chk.percent_off / 100) * 100) / 100;
  }
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const discountTotal = round2(listSubtotal - subtotal);
  const [{ data: methods }, pack, area] = await Promise.all([sb.from("shipping_methods").select("*").eq("active", true), getFrozenPack(), getShippingArea()]);
  if (!area.abroad && input.country !== "DE") throw new Error("We currently deliver within Germany only. Pickup in store is always possible.");
  const quotes = quoteShipping((methods ?? []) as ShippingMethod[], lines, subtotal, input.country, input.postal, pack);
  const q = quotes.find((x) => x.method.code === input.shipping_code);
  if (!q || !q.available) throw new Error(q?.reason ?? "Please choose a delivery option.");
  if (q.method.type !== "pickup" && (!input.street || !input.postal || !input.city))
    throw new Error("Please enter your delivery address.");
  const cashOk = (q.method.type === "pickup" && cfg.pub.cash.pickup) || (q.method.type === "local" && cfg.pub.cash.local);
  if (input.payment === "cash" && !cashOk) throw new Error("Paying on collection is only possible for pickup or local delivery.");

  // pickup time must be one of the slots that are still free
  let pickupAt: string | null = null;
  let pickupLabel = input.pickup_slot ?? null;
  if (q.method.type === "pickup" && input.pickup_at && input.pickup_at !== "call") {
    const slot = (await pickupSlots()).find((s) => s.value === input.pickup_at);
    if (!slot || slot.full) throw new Error("That pickup time is no longer available. Please choose another one.");
    pickupAt = slot.value;
    pickupLabel = slot.label.de ?? pickupLabel;
  }

  // shipping VAT follows the main rate of the goods (simplified: highest share)
  const tax19 = lines.filter((l) => l.tax_rate === 19).reduce((s, l) => s + l.price * l.qty, 0);
  const shipRate = tax19 > subtotal / 2 ? 19 : 7;
  const tax_total = round2(lines.reduce((s, l) => s + vatOf(l.price * l.qty, l.tax_rate), 0) + vatOf(q.price, shipRate));
  const total = round2(subtotal + q.price);
  const deposit = input.payment === "cash" ? depositFor(cfg.pub, total) : 0;
  if (deposit > 0 && (!input.deposit_provider || !cfg.online.includes(input.deposit_provider)))
    throw new Error("Please choose how to pay the deposit.");

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
      pickup_slot: pickupLabel,
      pickup_at: pickupAt,
      subtotal,
      shipping_total: q.price,
      frozen_boxes: q.packaging.boxes,
      packaging_total: q.packaging.fee,
      tax_total,
      total,
      payment_provider: input.payment === "bank" ? "bank" : deposit > 0 ? input.deposit_provider : input.payment,
      payment_method: deposit > 0 ? "cash_deposit" : input.payment,
      deposit_amount: deposit > 0 ? deposit : null,
      balance_due: input.payment === "cash" ? round2(total - deposit) : 0,
      notes: input.notes ?? null,
      coupon_code: couponCode,
      discount_total: discountTotal,
    })
    .select("id, number")
    .single();
  if (error || !order) throw new Error("Could not create order. Please try again.");
  if (couponCode) await consumeCoupon(couponCode);

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
  return { ...order, total, deposit, shipping_total: q.price, lines, method: q.method };
}

/** Creates the DHL label right after payment when that is switched on (parcel orders only). */
async function autoDhlLabel(orderId: string) {
  const { getDhl, createDhlLabel } = await import("./dhl");
  const c = await getDhl();
  if (!c.enabled || !c.auto) return;
  const { data: o } = await supabaseAdmin().from("orders").select("fulfillment_type, tracking_number").eq("id", orderId).single();
  if (o?.fulfillment_type === "parcel" && !o.tracking_number) await createDhlLabel(orderId);
}

/** Idempotent: called from webhooks / return URLs once payment is confirmed. */
export async function onOrderPaid(orderId: string, provider: string, ref: string) {
  const sb = supabaseAdmin();
  const { data: changed } = await sb.rpc("mark_order_paid", { p_order_id: orderId, p_provider: provider, p_ref: ref });
  if (!changed) return false;
  await forwardDropshipItems(orderId).catch(() => null);
  await autoDhlLabel(orderId).catch(() => null);
  await sendConfirmation(orderId).catch(() => null);
  return true;
}

/** Cash orders without deposit are confirmed right away but stay unpaid until collected; stock is reserved now. */
export async function confirmCashOrder(orderId: string) {
  const sb = supabaseAdmin();
  await sb.rpc("mark_order_paid", { p_order_id: orderId, p_provider: "cash", p_ref: "pay-on-collection" });
  await sb.from("orders").update({ status: "processing", paid_at: null }).eq("id", orderId);
  await forwardDropshipItems(orderId).catch(() => null);
  await sendConfirmation(orderId).catch(() => null);
}

/** Bank transfer: the order waits for the money; the customer gets the bank details by email. */
export async function confirmBankOrder(orderId: string) {
  await sendConfirmation(orderId).catch(() => null);
}

/** Gives the order a receipt number (once) and returns the receipt PDF. */
export async function receiptFor(orderId: string) {
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("*, order_items(*), shipping_methods(name)").eq("id", orderId).single();
  if (!o) return null;
  if (!o.receipt_number) {
    const { data: n } = await sb.rpc("next_receipt_number");
    if (n) {
      await sb.from("orders").update({ receipt_number: n }).eq("id", orderId).is("receipt_number", null);
      o.receipt_number = n;
    }
  }
  const { data: st } = await sb.from("settings").select("key, value").in("key", ["public.store", "public.receipt", "public.payments"]);
  const get = (k: string) => ((st ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, string>;
  const pay = get("public.payments") as unknown as { bank?: { holder?: string; iban?: string; bic?: string; bankName?: string } };
  const pdf = await buildReceiptPdf({
    order: o,
    store: get("public.store"),
    receipt: get("public.receipt"),
    bank: pay.bank,
  });
  return { pdf, number: o.receipt_number as number | null, order: o };
}

const PAY_TEXT: Record<string, string> = {
  stripe: "Card / Stripe",
  paypal: "PayPal",
  viva: "Viva Wallet",
  cash: "Payment on collection",
  cash_deposit: "Deposit paid online, rest on collection",
  bank: "Bank transfer",
};

async function sendConfirmation(orderId: string) {
  const r = await receiptFor(orderId);
  if (!r) return;
  const o = r.order;
  const rows = (o.order_items as { title: string; qty: number; unit_price: number }[])
    .map((i) => `<tr><td style="padding:4px 0">${i.qty} × ${esc(i.title)}</td><td align="right">${money(i.qty * i.unit_price)}</td></tr>`)
    .join("");
  const { data: st } = await supabaseAdmin().from("settings").select("value").eq("key", "public.payments").maybeSingle();
  const bank = (st?.value as { bank?: { holder?: string; iban?: string; bic?: string; bankName?: string; days?: number } } | null)?.bank;
  const extra =
    o.payment_method === "bank" && bank?.iban
      ? `<p style="font-family:sans-serif;font-size:14px;background:#f6f3ec;padding:12px;border-radius:8px"><b>Please transfer ${money(o.total)}</b> within ${bank.days ?? 7} days to:<br>${esc(bank.holder ?? "")}<br>IBAN ${esc(bank.iban)}${bank.bic ? `<br>BIC ${esc(bank.bic)}` : ""}${bank.bankName ? `<br>${esc(bank.bankName)}` : ""}<br>Reference: <b>Order ${o.number}</b></p>`
      : Number(o.balance_due) > 0
        ? `<p style="font-family:sans-serif;font-size:14px;background:#f6f3ec;padding:12px;border-radius:8px">${o.deposit_amount ? `Deposit paid: <b>${money(o.deposit_amount)}</b><br>` : ""}To pay on collection: <b>${money(o.balance_due)}</b></p>`
        : "";
  const pickup = o.pickup_slot ? `<p style="font-family:sans-serif;font-size:14px">Pickup: <b>${esc(o.pickup_slot)}</b></p>` : "";
  const html = `
    <h2 style="font-family:sans-serif;color:#1D5C3F">Thank you for your order #${o.number}</h2>
    <table style="font-family:sans-serif;font-size:14px" width="100%">${rows}
      <tr><td style="padding:4px 0">${esc((o.shipping_methods as { name: string } | null)?.name ?? "Shipping")}</td><td align="right">${money(o.shipping_total)}</td></tr>
      <tr><td style="padding:6px 0"><b>Total (incl. VAT)</b></td><td align="right"><b>${money(o.total)}</b></td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:13px;color:#555">Payment: ${PAY_TEXT[o.payment_method ?? o.payment_provider ?? ""] ?? o.payment_provider ?? ""}</p>
    ${pickup}${extra}
    <p style="font-family:sans-serif;font-size:13px"><a href="${siteUrl()}/order/${o.id}">View your order</a> · your receipt is attached as a PDF.</p>
    <p style="font-family:sans-serif;font-size:13px;color:#555">Questions? Reply to this email or message us on WhatsApp.</p>`;
  const attachments = [{ filename: `Beleg-${r.number ?? o.number}.pdf`, content: r.pdf }];
  await sendEmail({ to: o.email, subject: `Your Greenland order #${o.number}`, html, attachments });
  const alertTo = (await emailConfig()).alertTo;
  if (alertTo) await sendEmail({ to: alertTo, subject: `New order #${o.number} – ${money(o.total)}`, html, attachments });
}
