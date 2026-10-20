import { NextResponse } from "next/server";
import { CheckoutSchema, confirmBankOrder, confirmCashOrder, createOrder } from "@/lib/orders";
import { paypalCheckout, stripeCheckout, vivaCheckout, type PayableOrder } from "@/lib/payments";
import { getPaymentConfig } from "@/lib/commerce";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const parsed = CheckoutSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted fields." }, { status: 400 });
  const input = parsed.data;
  const cfg = await getPaymentConfig();
  if (!cfg.methods.includes(input.payment)) return NextResponse.json({ error: "This payment method is not available." }, { status: 400 });

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  try {
    const order = await createOrder(input, user?.id ?? null, cfg);
    const full: PayableOrder = {
      id: order.id,
      number: order.number,
      email: input.email,
      total: order.total,
      shipping_total: order.shipping_total,
      lines: order.lines.map((l) => ({ title: l.title, qty: l.qty, unit_price: l.price })),
    };
    // cash on pickup with a deposit: only the deposit is charged online now
    const charge: PayableOrder =
      order.deposit > 0
        ? { ...full, total: order.deposit, shipping_total: 0, lines: [{ title: `Anzahlung Bestellung #${order.number}`, qty: 1, unit_price: order.deposit }] }
        : full;
    const provider = order.deposit > 0 ? input.deposit_provider! : input.payment;

    let url: string;
    if (provider === "stripe") url = await stripeCheckout(charge, cfg);
    else if (provider === "paypal") url = await paypalCheckout(charge, cfg);
    else if (provider === "viva") url = await vivaCheckout(charge, cfg);
    else if (provider === "bank") {
      await confirmBankOrder(order.id);
      url = `/order/${order.id}`;
    } else {
      await confirmCashOrder(order.id);
      url = `/order/${order.id}`;
    }
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
