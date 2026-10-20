import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/payments";
import { onOrderPaid } from "@/lib/orders";
import { getPaymentConfig } from "@/lib/commerce";

// Stripe dashboard → Developers → Webhooks → endpoint https://<site>/api/webhooks/stripe
// events: checkout.session.completed, checkout.session.async_payment_succeeded
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event;
  try {
    const cfg = await getPaymentConfig();
    event = await stripe(cfg).webhooks.constructEventAsync(body, sig!, cfg.secrets.stripeWebhookSecret!, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid" && s.metadata?.order_id) {
      await onOrderPaid(s.metadata.order_id, "stripe", String(s.payment_intent ?? s.id));
    }
  }
  return NextResponse.json({ received: true });
}
