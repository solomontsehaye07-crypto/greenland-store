"use client";

import Link from "next/link";
import { useCart } from "@/components/cart";
import { money } from "@/lib/format";

const FREE_FROM = 69;

export default function CartPage() {
  const { lines, subtotal, setQty, remove, ready } = useCart();
  if (!ready) return <div className="mx-auto max-w-3xl px-4 pt-10 text-muted">Loading cart…</div>;
  if (!lines.length)
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <h1 className="text-4xl font-extrabold">Your cart is empty</h1>
        <p className="mt-3 text-muted">Add a few favourites and they will show up here.</p>
        <Link href="/c/food" className="btn btn-primary mt-8">
          Start with groceries
        </Link>
      </div>
    );
  const toFree = Math.max(0, FREE_FROM - subtotal);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="text-4xl font-extrabold">Cart</h1>
        <ul className="mt-6 divide-y divide-line rounded-3xl bg-white px-5">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.image_url ? <img src={l.image_url} alt="" className="h-20 w-20 rounded-xl object-contain" /> : <div className="h-20 w-20 rounded-xl bg-surface" />}
              <div className="min-w-0 flex-1">
                <Link href={`/p/${l.slug}`} className="line-clamp-2 font-medium hover:text-green">
                  {l.title}
                </Link>
                <div className="mt-1 text-sm text-muted">{money(l.price)} each{l.is_frozen ? " · frozen" : ""}</div>
                <button onClick={() => remove(l.id)} className="mt-1 text-sm text-danger hover:underline">
                  Remove
                </button>
              </div>
              <div className="flex items-center rounded-full border border-line">
                <button className="h-9 w-9" onClick={() => setQty(l.id, l.qty - 1)} aria-label={`Decrease ${l.title}`}>−</button>
                <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                <button className="h-9 w-9" onClick={() => setQty(l.id, Math.min(99, l.qty + 1))} aria-label={`Increase ${l.title}`}>+</button>
              </div>
              <div className="w-20 text-right font-semibold">{money(l.price * l.qty)}</div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-3xl bg-white p-6 lg:mt-16">
        <div className="flex justify-between text-lg">
          <span>Subtotal</span>
          <b>{money(subtotal)}</b>
        </div>
        <p className="mt-2 text-sm text-muted">
          {toFree > 0 ? `Add ${money(toFree)} more for free standard delivery.` : "Free standard delivery unlocked."}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-green" style={{ width: `${Math.min(100, (subtotal / FREE_FROM) * 100)}%` }} />
        </div>
        <Link href="/checkout" className="btn btn-primary mt-6 w-full py-3 text-base">
          Go to checkout
        </Link>
        <p className="mt-3 text-center text-xs text-muted">Shipping is calculated at checkout. Prices incl. VAT.</p>
      </aside>
    </div>
  );
}
