import { NextResponse } from "next/server";
import { vivaVerify } from "@/lib/payments";
import { onOrderPaid } from "@/lib/orders";
import { getPaymentConfig } from "@/lib/commerce";

// Set as "Success URL" of your Viva payment source: https://<site>/api/payments/viva/return
// Viva appends ?t=<transactionId>&s=<orderCode>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  if (!t) return NextResponse.redirect(new URL("/checkout?failed=1", url));
  const v = await vivaVerify(t, await getPaymentConfig()).catch(() => null);
  if (v?.orderId) {
    await onOrderPaid(v.orderId, "viva", t);
    return NextResponse.redirect(new URL(`/order/${v.orderId}?paid=1`, url));
  }
  return NextResponse.redirect(new URL("/checkout?failed=1", url));
}
