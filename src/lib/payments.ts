import Stripe from "stripe";

import { siteUrl } from "./site";

export type Provider = "stripe" | "paypal" | "viva" | "cash";

export function enabledProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.STRIPE_SECRET_KEY) list.push("stripe");
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) list.push("paypal");
  if (process.env.VIVA_CLIENT_ID && process.env.VIVA_CLIENT_SECRET) list.push("viva");
  list.push("cash"); // pay at pickup / on local delivery
  return list;
}

export interface PayableOrder {
  id: string;
  number: number;
  email: string;
  total: number;
  lines: { title: string; qty: number; unit_price: number }[];
  shipping_total: number;
}

// ---------------- Stripe (cards, Apple/Google Pay, Klarna, SEPA – per your Stripe dashboard) ----------------
export function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { httpClient: Stripe.createFetchHttpClient() });
}

export async function stripeCheckout(o: PayableOrder) {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = o.lines.map((l) => ({
    quantity: l.qty,
    price_data: { currency: "eur", unit_amount: Math.round(l.unit_price * 100), product_data: { name: l.title } },
  }));
  if (o.shipping_total > 0)
    items.push({
      quantity: 1,
      price_data: { currency: "eur", unit_amount: Math.round(o.shipping_total * 100), product_data: { name: "Shipping" } },
    });
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: o.email,
    line_items: items,
    client_reference_id: o.id,
    metadata: { order_id: o.id },
    success_url: `${siteUrl()}/order/${o.id}?paid=1`,
    cancel_url: `${siteUrl()}/checkout?cancelled=1`,
  });
  return session.url!;
}

// ---------------- PayPal (Orders v2) ----------------
const PAYPAL_BASE = () =>
  process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${PAYPAL_BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal auth failed");
  return (await r.json()).access_token as string;
}

export async function paypalCheckout(o: PayableOrder) {
  const token = await paypalToken();
  const r = await fetch(`${PAYPAL_BASE()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        { reference_id: o.id, custom_id: o.id, description: `Order #${o.number}`, amount: { currency_code: "EUR", value: o.total.toFixed(2) } },
      ],
      application_context: {
        brand_name: "Greenland Afro Asia Store",
        user_action: "PAY_NOW",
        return_url: `${siteUrl()}/api/payments/paypal/return?order=${o.id}`,
        cancel_url: `${siteUrl()}/checkout?cancelled=1`,
      },
    }),
  });
  const data = await r.json();
  const link = data.links?.find((l: { rel: string }) => l.rel === "approve")?.href;
  if (!link) throw new Error("PayPal order failed");
  return link as string;
}

/** Captures an approved PayPal order. Returns capture id when COMPLETED. */
export async function paypalCapture(paypalOrderId: string) {
  const token = await paypalToken();
  const r = await fetch(`${PAYPAL_BASE()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await r.json();
  if (data.status !== "COMPLETED") return null;
  return {
    captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id as string,
    orderId: data.purchase_units?.[0]?.reference_id as string,
  };
}

// ---------------- Viva Wallet (Smart Checkout) ----------------
const VIVA_ACCOUNTS = () =>
  process.env.VIVA_ENV === "live" ? "https://accounts.vivapayments.com" : "https://demo-accounts.vivapayments.com";
const VIVA_API = () => (process.env.VIVA_ENV === "live" ? "https://api.vivapayments.com" : "https://demo-api.vivapayments.com");
const VIVA_CHECKOUT = () =>
  process.env.VIVA_ENV === "live" ? "https://www.vivapayments.com" : "https://demo.vivapayments.com";

async function vivaToken() {
  const auth = Buffer.from(`${process.env.VIVA_CLIENT_ID}:${process.env.VIVA_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${VIVA_ACCOUNTS()}/connect/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("Viva auth failed");
  return (await r.json()).access_token as string;
}

export async function vivaCheckout(o: PayableOrder) {
  const token = await vivaToken();
  const r = await fetch(`${VIVA_API()}/checkout/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(o.total * 100),
      customerTrns: `Greenland order #${o.number}`,
      customer: { email: o.email, requestLang: "de-DE" },
      sourceCode: process.env.VIVA_SOURCE_CODE,
      merchantTrns: o.id,
    }),
  });
  const data = await r.json();
  if (!data.orderCode) throw new Error("Viva order failed");
  return `${VIVA_CHECKOUT()}/web/checkout?ref=${data.orderCode}`;
}

/** Looks up a Viva transaction; returns our order id when it is paid. */
export async function vivaVerify(transactionId: string) {
  const token = await vivaToken();
  const r = await fetch(`${VIVA_API()}/checkout/v2/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const t = await r.json();
  // statusId "F" = finished/paid
  return t.statusId === "F" ? { orderId: t.merchantTrns as string, amount: t.amount as number } : null;
}
