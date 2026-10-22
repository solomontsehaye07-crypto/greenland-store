"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { lineUnit } from "@/lib/tiers";
import { useCart } from "@/components/cart";
import { quoteShipping } from "@/lib/shipping";
import type { FrozenPack } from "@/lib/frozen";
import { money } from "@/lib/format";
import type { ShippingMethod } from "@/lib/types";

type Provider = "stripe" | "paypal" | "viva" | "bank" | "cash";
export type PayOption = { id: Provider; name: string; note?: string };
type Deposit = { enabled: boolean; percent: number; fixed: number; minOrder: number };

function depositOf(d: Deposit, total: number) {
  if (!d.enabled || total < (Number(d.minOrder) || 0)) return 0;
  const a = Number(d.fixed) > 0 ? Number(d.fixed) : (total * (Number(d.percent) || 0)) / 100;
  return Math.min(total, Math.round(a * 100) / 100);
}

const COUNTRIES = [
  ["DE", "Germany"],
  ["AT", "Austria"],
  ["NL", "Netherlands"],
  ["BE", "Belgium"],
  ["LU", "Luxembourg"],
  ["FR", "France"],
];

const SAVED_KEY = "greenland.checkout.details.v1";
type Saved = { name?: string; email?: string; phone?: string; street?: string; postal?: string; city?: string };
function readSaved(): Saved {
  if (typeof window === "undefined") return {};
  try {
    return (JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Saved) ?? {};
  } catch {
    return {};
  }
}

export function CheckoutForm({
  methods,
  pack,
  abroad,
  options,
  online,
  cashPickup,
  cashLocal,
  deposit,
  slots,
  allowAsap,
  pickupNote,
  pickupAddress,
  prefill,
  gift,
  deliveryWindows = [],
  deliveryHours = "",
  deliveryCutoff = 30,
}: {
  methods: ShippingMethod[];
  pack: FrozenPack;
  abroad: boolean;
  options: PayOption[];
  online: { id: "stripe" | "paypal" | "viva"; name: string }[];
  cashPickup: boolean;
  cashLocal: boolean;
  deposit: Deposit;
  slots: { value: string; label: string; full: boolean }[];
  allowAsap: boolean;
  pickupNote?: string;
  pickupAddress?: string;
  prefill?: Saved; // from the customer's account when signed in
  gift?: import("@/lib/perks").CartPerks["gift"];
  deliveryWindows?: { value: string; label: string; orderBy: string }[];
  deliveryHours?: string;
  deliveryCutoff?: number;
}) {
  const { lines, listSubtotal, tiers, ready, clear } = useCart();
  // details from the last order on this device (only if the customer agreed to remember them)
  const [saved] = useState<Saved>(() => ({ ...readSaved(), ...Object.fromEntries(Object.entries(prefill ?? {}).filter(([, v]) => v)) }));
  const [rememberMe, setRememberMe] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [couponState, setCouponState] = useState<{ ok: boolean; percent_off?: number; reason?: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [country, setCountry] = useState("DE");
  const [postal, setPostal] = useState(saved.postal ?? "");
  const [street, setStreet] = useState(saved.street ?? "");
  const [city, setCity] = useState(saved.city ?? "");
  // km from the shop (local delivery within a radius): undefined = not checked, null = address not found
  const [distanceKm, setDistanceKm] = useState<number | null | undefined>(undefined);
  const [measuring, setMeasuring] = useState(false);
  const needsDistance = methods.some((m) => m.type === "local" && Number(m.max_distance_km) > 0);
  useEffect(() => {
    if (!needsDistance) return;
    if (!/^\d{5}$/.test(postal) || street.trim().length < 3 || city.trim().length < 2) {
      setDistanceKm(undefined);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setMeasuring(true);
      try {
        const r = await fetch("/api/distance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ street, postal, city, country }) });
        const j = await r.json();
        if (alive) setDistanceKm(typeof j.km === "number" ? j.km : null);
      } catch {
        if (alive) setDistanceKm(null);
      } finally {
        if (alive) setMeasuring(false);
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [needsDistance, street, postal, city, country]);
  const [code, setCode] = useState<string>("");
  const [payment, setPayment] = useState<Provider>(options[0]?.id ?? "cash");
  const [depositProvider, setDepositProvider] = useState(online[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // same rule as the server: per line the bigger of quantity discount and discount code
  const couponPct = couponState?.ok && couponState.percent_off ? couponState.percent_off : 0;
  const priced = lines.map((l) => ({ l, ...lineUnit(l.price, l.qty, tiers, l.qd !== false, couponPct) }));
  const subtotal = listSubtotal;
  const cut = (src: "tier" | "coupon") => Math.round(priced.filter((x) => x.source === src).reduce((s, x) => s + (x.l.price - x.unit) * x.l.qty, 0) * 100) / 100;
  const tierCut = cut("tier");
  const couponCut = cut("coupon");
  const discount = Math.round((tierCut + couponCut) * 100) / 100;
  // the server judges "free delivery from" on the value after the discount code, so the page does too
  const quotes = useMemo(() => quoteShipping(methods, lines, subtotal - discount, country, postal, pack, distanceKm), [methods, lines, subtotal, discount, country, postal, pack, distanceKm]);
  const giftOn = !!gift && subtotal - discount >= gift.threshold;
  const chosen = quotes.find((q) => q.method.code === code && q.available) ?? null;
  const isPickup = chosen?.method.type === "pickup";
  const cashAllowed = chosen ? (chosen.method.type === "pickup" && cashPickup) || (chosen.method.type === "local" && cashLocal) : false;
  const hasAlcohol = lines.some((l) => l.age_restricted);
  const total = subtotal - discount + (chosen?.price ?? 0);
  const checkCode = async (code: string, email: string) => {
    if (!code.trim()) return setCouponState(null);
    setCouponBusy(true);
    try {
      const r = await fetch(`/api/coupon?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}&subtotal=${subtotal}`);
      setCouponState(await r.json());
    } catch {
      setCouponState({ ok: false, reason: "Could not check the code." });
    } finally {
      setCouponBusy(false);
    }
  };
  const dep = payment === "cash" ? depositOf(deposit, total) : 0;
  const needsDeposit = dep > 0;

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
    if (payment === "cash" && !cashAllowed) return setError("Paying on collection is only possible for pickup or local delivery.");
    if (needsDeposit && !depositProvider) return setError("Paying on collection needs a deposit, but no online payment is set up yet. Please choose another payment method.");
    const f = new FormData(e.currentTarget);
    try {
      if (rememberMe) {
        const keep: Saved = { name: String(f.get("name") ?? ""), email: String(f.get("email") ?? ""), phone: String(f.get("phone") ?? ""), postal };
        if (f.get("street")) Object.assign(keep, { street: String(f.get("street")), city: String(f.get("city") ?? "") });
        else Object.assign(keep, { street: saved.street, city: saved.city });
        localStorage.setItem(SAVED_KEY, JSON.stringify(keep));
      } else localStorage.removeItem(SAVED_KEY);
    } catch {
      /* storage unavailable */
    }
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
          pickup_at: f.get("pickup_at") ?? undefined,
          delivery_at: f.get("delivery_at") ?? undefined,
          pickup_slot: isPickup ? (slots.find((s) => s.value === f.get("pickup_at"))?.label ?? "I will call before coming") : undefined,
          payment,
          deposit_provider: needsDeposit ? depositProvider : undefined,
          notes: f.get("notes") || undefined,
          age_confirmed: f.get("age") === "on",
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
          coupon: couponState?.ok ? coupon.trim() : undefined,
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
              <input id="name" name="name" required autoComplete="name" defaultValue={saved.name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" defaultValue={saved.email} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone / WhatsApp</label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" defaultValue={saved.phone} className="input" />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="accent-[var(--green)]" />
            Remember my details on this device for next time
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-xl font-bold display">Delivery</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="country">Country</label>
              {abroad ? (
                <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="input">
                  {COUNTRIES.map(([c, n]) => (
                    <option key={c} value={c}>{n}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input id="country" value="Germany" readOnly className="input" aria-describedby="country-note" />
                  <p id="country-note" className="mt-1 text-xs text-muted">We deliver within Germany only.</p>
                </>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="street">Street and house number{isPickup ? " (optional for pickup)" : ""}</label>
              <input id="street" name="street" required={!isPickup} value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="shipping street-address" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="postal">Postcode</label>
              <input id="postal" value={postal} onChange={(e) => setPostal(e.target.value.trim())} autoComplete="shipping postal-code" inputMode="numeric" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" required={!isPickup} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="shipping address-level2" className="input" />
            </div>
          </div>
          {needsDistance && (measuring || typeof distanceKm === "number") && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {measuring ? "Checking the distance to our shop …" : `${distanceKm!.toLocaleString("de-DE")} km from our shop (straight line)`}
            </p>
          )}
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
                  {q.available && q.packaging.boxes > 0 && (
                    <span className="mt-1 block text-xs text-[#14466B]">
                      {q.packaging.boxes} × insulated box for frozen food ({money(pack.boxPrice)} each) included
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {chosen?.method.type === "local" && (
            <div className="mt-5 max-w-md space-y-2">
              <label className="label" htmlFor="delivery_at">Delivery time</label>
              {deliveryWindows.length ? (
                <>
                  <select id="delivery_at" name="delivery_at" required className="input" defaultValue={deliveryWindows[0].value}>
                    {deliveryWindows.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                  <p className="text-sm text-muted">
                    We deliver once a day: {deliveryHours}. Orders up to {deliveryCutoff} minutes before the start go out the same day.
                  </p>
                </>
              ) : (
                <p className="text-sm text-danger">No delivery times are available right now. Please choose pickup.</p>
              )}
            </div>
          )}
          {isPickup && (
            <div className="mt-5 max-w-md space-y-2">
              <label className="label" htmlFor="pickup_at">Pickup time</label>
              <select id="pickup_at" name="pickup_at" required className="input">
                {slots.filter((s) => !s.full).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
                {allowAsap && <option value="call">I will call before coming</option>}
              </select>
              {!slots.some((s) => !s.full) && !allowAsap && <p className="text-sm text-danger">No pickup times are free right now. Please choose another delivery option.</p>}
              {pickupAddress && <p className="whitespace-pre-line text-sm text-muted">{pickupAddress}</p>}
              {pickupNote && <p className="whitespace-pre-line text-sm text-muted">{pickupNote}</p>}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xl font-bold display">Payment</legend>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Payment method">
            {options.map((o) => {
              const p = o.id;
              const disabled = p === "cash" && !cashAllowed;
              return (
                <label key={p} className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${payment === p ? "border-green ring-2 ring-green/20" : "border-line"} ${disabled ? "opacity-50" : ""}`}>
                  <input type="radio" name="pay" className="mt-1 accent-[var(--green)]" checked={payment === p} disabled={disabled} onChange={() => setPayment(p)} />
                  <span>
                    <span className="block font-semibold">{o.name}</span>
                    {o.note && <span className="block text-sm text-muted">{o.note}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {needsDeposit && (
            <div className="mt-4 rounded-2xl border border-saffron bg-saffron/10 p-4 text-sm">
              <p className="font-semibold">Deposit of {money(dep)} now, {money(total - dep)} on collection</p>
              <p className="mt-1 text-muted">We hold your goods with a small deposit paid online. Pay the deposit with:</p>
              {online.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {online.map((o) => (
                    <label key={o.id} className={`cursor-pointer rounded-full border px-3 py-1.5 ${depositProvider === o.id ? "border-green bg-white font-semibold" : "border-line bg-white/60"}`}>
                      <input type="radio" name="deposit_provider" className="sr-only" checked={depositProvider === o.id} onChange={() => setDepositProvider(o.id)} />
                      {o.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-danger">Online payment is not set up yet, so a deposit can’t be taken. Please choose another payment method.</p>
              )}
            </div>
          )}
        </fieldset>

        <div>
          <label className="label" htmlFor="notes">Notes for us (optional)</label>
          <textarea id="notes" name="notes" rows={3} className="input" />
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl bg-white p-6 lg:sticky lg:top-40">
        <h2 className="text-xl font-bold">Your order</h2>
        <ul className="max-h-64 space-y-2 overflow-auto text-sm">
          {priced.map(({ l, unit }) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="line-clamp-1">{l.qty} × {l.title}</span>
              <span className="shrink-0">{unit < l.price && <s className="mr-1.5 text-xs text-muted">{money(l.price * l.qty)}</s>}{money(unit * l.qty)}</span>
            </li>
          ))}
          {giftOn && (
            <li className="flex justify-between gap-3 text-forest">
              <span className="line-clamp-1">1 × {gift!.title_de || gift!.title} <span className="text-xs">(Geschenk / gift)</span></span>
              <span className="shrink-0 font-semibold">{money(0)}</span>
            </li>
          )}
        </ul>
        <div className="border-t border-line pt-4">
          <label className="label" htmlFor="coupon">Discount code</label>
          <div className="flex gap-2">
            <input
              id="coupon"
              value={coupon}
              onChange={(e) => {
                setCoupon(e.target.value.toUpperCase());
                setCouponState(null);
              }}
              onBlur={(e) => checkCode(e.target.value, String((e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? ""))}
              placeholder="e.g. WELCOME-XXXXX"
              autoComplete="off"
              data-no-memory
              className="input flex-1 uppercase"
            />
            <button type="button" onClick={(e) => checkCode(coupon, String((e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? ""))} disabled={couponBusy || !coupon.trim()} className="btn btn-ghost shrink-0">
              {couponBusy ? "…" : "Apply"}
            </button>
          </div>
          {couponState && (
            <p className={`mt-1 text-xs ${couponState.ok ? "text-forest" : "text-danger"}`} role="status">
              {couponState.ok ? `${couponState.percent_off} % off – applied.` : couponState.reason}
            </p>
          )}
        </div>
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {tierCut > 0 && <div className="flex justify-between text-forest"><span>Quantity discount</span><span>− {money(tierCut)}</span></div>}
          {couponCut > 0 && <div className="flex justify-between text-forest"><span>Discount code {couponPct} %</span><span>− {money(couponCut)}</span></div>}
          {couponPct > 0 && couponCut === 0 && <p className="text-xs text-muted">Your quantity discounts are bigger than the code, so the code is kept for another order.</p>}
          <div className="flex justify-between"><span>Delivery</span><span>{chosen ? (chosen.delivery ? money(chosen.delivery) : "Free") : "—"}</span></div>
          {chosen && chosen.packaging.boxes > 0 && (
            <div className="flex justify-between"><span>Frozen packaging ({chosen.packaging.boxes} {chosen.packaging.boxes === 1 ? "box" : "boxes"})</span><span>{money(chosen.packaging.fee)}</span></div>
          )}
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
          {busy ? "Placing order…" : needsDeposit ? `Order and pay deposit ${money(dep)}` : payment === "cash" ? `Place order (${money(total)} on collection)` : payment === "bank" ? `Place order (${money(total)} by transfer)` : `Order and pay ${money(total)}`}
        </button>
      </aside>
    </form>
  );
}
