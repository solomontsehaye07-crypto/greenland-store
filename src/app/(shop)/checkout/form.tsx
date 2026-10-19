"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart";
import { quoteShipping } from "@/lib/shipping";
import { money } from "@/lib/format";
import type { ShippingMethod } from "@/lib/types";
import type { Provider } from "@/lib/payments";

const PROVIDER_LABEL: Record<Provider, { name: string; note: string }> = {
  stripe: { name: "Card, Apple Pay, Google Pay, Klarna", note: "Secure payment with Stripe" },
  paypal: { name: "PayPal", note: "Pay with your PayPal account" },
  viva: { name: "Viva Wallet", note: "Cards and local payment methods" },
  cash: { name: "Cash or card on pickup / delivery", note: "Only for pickup and local delivery" },
};

const COUNTRIES = [
  ["DE", "Germany"],
  ["AT", "Austria"],
  ["NL", "Netherlands"],
  ["BE", "Belgium"],
  ["LU", "Luxembourg"],
  ["FR", "France"],
];

export function CheckoutForm({ methods, providers }: { methods: ShippingMethod[]; providers: Provider[] }) {
  const { lines, subtotal, ready, clear } = useCart();
  const [country, setCountry] = useState("DE");
  const [postal, setPostal] = useState("");
  const [code, setCode] = useState<string>("");
  const [payment, setPayment] = useState<Provider>(providers[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quotes = useMemo(() => quoteShipping(methods, lines, subtotal, country, postal), [methods, lines, subtotal, country, postal]);
  const chosen = quotes.find((q) => q.method.code === code && q.available) ?? null;
  const isPickup = chosen?.method.type === "pickup";
  const cashAllowed = chosen ? ["pickup", "local"].includes(chosen.method.type) : false;
  const hasAlcohol = lines.some((l) => l.age_restricted);
  const total = subtotal + (chosen?.price ?? 0);

  if (!ready) return <p className="mt-6 text-muted">Loading…</p>;
  if (!lines.length)
    return (
      <p className="mt-6">
        Your cart is empty. <Link href="/" className="text-green underline">Continue shopping</Link>
      </p>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!chosen) return setError("Please choose a delivery option.");
    if (payment === "cash" && !cashAllowed) return setError("Cash is only possible for pickup or local delivery.");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: f.get("email"),
          phone: f.get("phone"),
          name: f.get("name"),
          street: f.get("street") ?? "",
          postal,
          city: f.get("city") ?? "",
          country,
          shipping_code: chosen.method.code,
          pickup_slot: f.get("pickup_slot") ?? undefined,
          payment,
          notes: f.get("notes") || undefined,
          age_confirmed: f.get("age") === "on",
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url.startsWith("/")) clear();
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-10">
        <fieldset>
          <legend className="text-xl font-bold display">Contact</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" required autoComplete="name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone / WhatsApp</label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" className="input" />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xl font-bold display">Delivery</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="country">Country</label>
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="input">
                {COUNTRIES.map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="postal">Postcode</label>
              <input id="postal" value={postal} onChange={(e) => setPostal(e.target.value.trim())} autoComplete="postal-code" className="input" />
            </div>
          </div>
          <div className="mt-5 space-y-2" role="radiogroup" aria-label="Delivery option">
            {quotes.map((q) => (
              <label
                key={q.method.code}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${code === q.method.code && q.available ? "border-green ring-2 ring-green/20" : "border-line"} ${!q.available ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input type="radio" name="ship" className="mt-1 accent-[var(--green)]" disabled={!q.available} checked={code === q.method.code} onChange={() => setCode(q.method.code)} />
                <span className="flex-1">
                  <span className="flex justify-between gap-2 font-semibold">
                    {q.method.name}
                    <span>{q.price === 0 ? "Free" : money(q.price)}</span>
                  </span>
                  <span className="block text-sm text-muted">{q.available ? q.method.description : q.reason}</span>
                </span>
              </label>
            ))}
          </div>
          {chosen && !isPickup && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="label" htmlFor="street">Street and house number</label>
                <input id="street" name="street" required autoComplete="street-address" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="city">City</label>
                <input id="city" name="city" required autoComplete="address-level2" className="input" />
              </div>
            </div>
          )}
          {isPickup && (
            <div className="mt-5 max-w-sm">
              <label className="label" htmlFor="pickup_slot">Preferred pickup time</label>
              <select id="pickup_slot" name="pickup_slot" className="input">
                <option>Today, after 2 pm</option>
                <option>Tomorrow morning</option>
                <option>Tomorrow afternoon</option>
                <option>I will call before coming</option>
              </select>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xl font-bold display">Payment</legend>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Payment method">
            {providers.map((p) => {
              const disabled = p === "cash" && !cashAllowed;
              return (
                <label key={p} className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${payment === p ? "border-green ring-2 ring-green/20" : "border-line"} ${disabled ? "opacity-50" : ""}`}>
                  <input type="radio" name="pay" className="mt-1 accent-[var(--green)]" checked={payment === p} disabled={disabled} onChange={() => setPayment(p)} />
                  <span>
                    <span className="block font-semibold">{PROVIDER_LABEL[p].name}</span>
                    <span className="block text-sm text-muted">{PROVIDER_LABEL[p].note}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="notes">Notes for us (optional)</label>
          <textarea id="notes" name="notes" rows={3} className="input" />
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl bg-white p-6 lg:sticky lg:top-40">
        <h2 className="text-xl font-bold">Your order</h2>
        <ul className="max-h-64 space-y-2 overflow-auto text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="line-clamp-1">{l.qty} × {l.title}</span>
              <span className="shrink-0">{money(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{chosen ? (chosen.price ? money(chosen.price) : "Free") : "—"}</span></div>
          <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
          <p className="text-xs text-muted">incl. VAT</p>
        </div>
        {hasAlcohol && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="age" required className="mt-1 accent-[var(--green)]" />
            I confirm I am at least 18 years old.
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-1 accent-[var(--green)]" />
          <span>
            I accept the <Link href="/legal/agb" className="underline">terms</Link> and have read the{" "}
            <Link href="/legal/widerruf" className="underline">cancellation policy</Link> and{" "}
            <Link href="/legal/datenschutz" className="underline">privacy policy</Link>.
          </span>
        </label>
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <button disabled={busy} className="btn btn-primary w-full py-3 text-base">
          {busy ? "Placing order…" : `Order and pay ${money(total)}`}
        </button>
      </aside>
    </form>
  );
}
