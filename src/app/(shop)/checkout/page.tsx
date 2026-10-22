import { supabasePublic } from "@/lib/supabase";
import { getFrozenPack, getPaymentConfig, getPickupSettings, getShippingArea, describeLocalTimes, getLocalTimes, localDeliveryWindows, pickupSlots } from "@/lib/commerce";
import { getLang, tx } from "@/lib/i18n";
import type { ShippingMethod } from "@/lib/types";
import { CheckoutForm, type PayOption } from "./form";
import { currentCustomer } from "@/lib/customer";
import { getCartPerks } from "@/lib/perks";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string; failed?: string }> }) {
  const sp = await searchParams;
  const [{ data }, cfg, pickup, lang, pack, area] = await Promise.all([
    supabasePublic().from("shipping_methods").select("*").eq("active", true).order("sort"),
    getPaymentConfig(),
    getPickupSettings(),
    getLang(),
    getFrozenPack(),
    getShippingArea(),
  ]);
  const localTimes = await getLocalTimes();
  const [slots, me, perks, windows] = await Promise.all([pickupSlots(pickup), currentCustomer(), getCartPerks(), localDeliveryWindows(5, new Date(), localTimes, pickup.closed)]);
  const prefill = me ? { name: me.full_name ?? "", email: me.email, phone: me.phone ?? "", street: me.address?.street ?? "", postal: me.address?.postal ?? "", city: me.address?.city ?? "" } : undefined;
  const notice = sp.cancelled ? "Payment was cancelled. Your cart is still here." : sp.failed ? "Payment did not go through. Please try again or choose another method." : null;
  const NOTE: Record<string, string> = {
    stripe: "Secure payment with Stripe",
    paypal: "Pay with your PayPal account",
    viva: "Cards and local payment methods",
    bank: "You get our bank details by email; we send or hand over the goods once the money has arrived",
    cash: "Only for pickup and local delivery",
  };
  const options: PayOption[] = cfg.methods.map((m) => ({ id: m, name: tx(cfg.pub[m].label, lang) || m, note: NOTE[m] }));
  const methods = ((data ?? []) as ShippingMethod[])
    // inside-Germany mode: options that only deliver abroad are not offered at all
    .filter((m) => area.abroad || m.type === "pickup" || m.countries.includes("DE"))
    .map((m) => ({
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
        abroad={area.abroad}
        options={options}
        online={cfg.online.map((o) => ({ id: o, name: tx(cfg.pub[o].label, lang) || o }))}
        cashPickup={cfg.pub.cash.pickup}
        cashLocal={cfg.pub.cash.local}
        deposit={cfg.pub.deposit}
        slots={slots.map((s) => ({ value: s.value, label: tx(s.label, lang), full: s.full }))}
        allowAsap={pickup.allowAsap}
        pickupNote={tx(pickup.note, lang)}
        pickupAddress={tx(pickup.address, lang)}
        prefill={prefill}
        gift={perks.gift}
        deliveryHours={describeLocalTimes(localTimes, lang)}
        deliveryCutoff={localTimes.cutoffMin}
        deliveryWindows={windows.map((w) => ({ value: w.value, label: tx(w.label, lang), orderBy: w.orderBy }))}
      />
    </div>
  );
}
