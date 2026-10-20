import { supabasePublic } from "@/lib/supabase";
import { getFrozenPack, getPaymentConfig, getPickupSettings, pickupSlots } from "@/lib/commerce";
import { getLang, tx } from "@/lib/i18n";
import type { ShippingMethod } from "@/lib/types";
import { CheckoutForm, type PayOption } from "./form";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string; failed?: string }> }) {
  const sp = await searchParams;
  const [{ data }, cfg, pickup, lang, pack] = await Promise.all([
    supabasePublic().from("shipping_methods").select("*").eq("active", true).order("sort"),
    getPaymentConfig(),
    getPickupSettings(),
    getLang(),
    getFrozenPack(),
  ]);
  const slots = await pickupSlots(pickup);
  const notice = sp.cancelled ? "Payment was cancelled. Your cart is still here." : sp.failed ? "Payment did not go through. Please try again or choose another method." : null;
  const NOTE: Record<string, string> = {
    stripe: "Secure payment with Stripe",
    paypal: "Pay with your PayPal account",
    viva: "Cards and local payment methods",
    bank: "You get our bank details by email; we send or hand over the goods once the money has arrived",
    cash: "Only for pickup and local delivery",
  };
  const options: PayOption[] = cfg.methods.map((m) => ({ id: m, name: tx(cfg.pub[m].label, lang) || m, note: NOTE[m] }));
  const methods = ((data ?? []) as ShippingMethod[]).map((m) => ({
    ...m,
    name: (lang === "de" && (m as ShippingMethod & { name_de?: string }).name_de) || m.name,
    description: (lang === "de" && (m as ShippingMethod & { description_de?: string }).description_de) || m.description,
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="display text-3xl font-semibold tracking-tight sm:text-4xl">Checkout</h1>
      {notice && <p className="mt-4 rounded-xl bg-gold/30 px-4 py-3 text-sm">{notice}</p>}
      <CheckoutForm
        methods={methods}
        pack={pack}
        options={options}
        online={cfg.online.map((o) => ({ id: o, name: tx(cfg.pub[o].label, lang) || o }))}
        cashPickup={cfg.pub.cash.pickup}
        cashLocal={cfg.pub.cash.local}
        deposit={cfg.pub.deposit}
        slots={slots.map((s) => ({ value: s.value, label: tx(s.label, lang), full: s.full }))}
        allowAsap={pickup.allowAsap}
        pickupNote={tx(pickup.note, lang)}
        pickupAddress={tx(pickup.address, lang)}
      />
    </div>
  );
}
