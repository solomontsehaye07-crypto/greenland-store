import { NextResponse } from "next/server";
import { CheckoutSchema, createOrder, confirmCashOrder } from "@/lib/orders";
import { enabledProviders, paypalCheckout, stripeCheckout, vivaCheckout } from "@/lib/payments";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const parsed = CheckoutSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted fields." }, { status: 400 });
  const input = parsed.data;
  if (!enabledProviders().includes(input.payment))
    return NextResponse.json({ error: "This payment method is not available." }, { status: 400 });

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  try {
    const order = await createOrder(input, user?.id ?? null);
    const payable = {
      id: order.id,
      number: order.number,
      email: input.email,
      total: order.total,
      shipping_total: order.shipping_total,
      lines: order.lines.map((l) => ({ title: l.title, qty: l.qty, unit_price: l.price })),
    };
    let url: string;
    switch (input.payment) {
      case "stripe":
        url = await stripeCheckout(payable);
        break;
      case "paypal":
        url = await paypalCheckout(payable);
        break;
      case "viva":
        url = await vivaCheckout(payable);
        break;
      default:
        await confirmCashOrder(order.id);
        url = `/order/${order.id}`;
    }
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
