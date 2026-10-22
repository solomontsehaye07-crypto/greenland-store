import { NextResponse } from "next/server";
import { paypalCapture } from "@/lib/payments";
import { onOrderPaid } from "@/lib/orders";
import { getPaymentConfig } from "@/lib/commerce";

// PayPal redirects here with ?order=<our id>&token=<paypal order id>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const order = url.searchParams.get("order");
  const token = url.searchParams.get("token");
  if (!order || !token) return NextResponse.redirect(new URL("/checkout?cancelled=1", url));
  const cap = await paypalCapture(token, await getPaymentConfig()).catch(() => null);
  if (cap && cap.orderId === order) {
    await onOrderPaid(order, "paypal", cap.captureId, cap.fee);
    return NextResponse.redirect(new URL(`/order/${order}?paid=1`, url));
  }
  return NextResponse.redirect(new URL(`/checkout?failed=1`, url));
}
