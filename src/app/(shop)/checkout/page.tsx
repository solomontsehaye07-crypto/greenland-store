import { supabasePublic } from "@/lib/supabase";
import { enabledProviders } from "@/lib/payments";
import type { ShippingMethod } from "@/lib/types";
import { CheckoutForm } from "./form";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string; failed?: string }> }) {
  const sp = await searchParams;
  const { data } = await supabasePublic().from("shipping_methods").select("*").eq("active", true).order("sort");
  const notice = sp.cancelled ? "Payment was cancelled. Your cart is still here." : sp.failed ? "Payment did not go through. Please try again or choose another method." : null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="text-4xl font-extrabold">Checkout</h1>
      {notice && <p className="mt-4 rounded-xl bg-gold/30 px-4 py-3 text-sm">{notice}</p>}
      <CheckoutForm methods={(data ?? []) as ShippingMethod[]} providers={enabledProviders()} />
    </div>
  );
}
