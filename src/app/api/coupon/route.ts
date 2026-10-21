import { NextResponse } from "next/server";
import { checkCoupon } from "@/lib/coupons";

/** Live check of a discount code while the customer types it in the checkout. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") ?? "").slice(0, 40);
  const email = (u.searchParams.get("email") ?? "").slice(0, 160);
  const subtotal = Number(u.searchParams.get("subtotal") ?? 0) || 0;
  const r = await checkCoupon(code, email, subtotal);
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
