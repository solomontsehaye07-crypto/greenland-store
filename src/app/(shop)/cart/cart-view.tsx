"use client";

import Link from "next/link";
import { img } from "@/lib/img";
import { useCart } from "@/components/cart";
import { money } from "@/lib/format";
import { GiftLine, LinePrice, PerksBar, Upsell } from "@/components/cart-extras";
import type { CartPerks } from "@/lib/perks";
import { RecipeSuggestions } from "@/components/recipe-suggestions";
import { FrozenBoxes } from "@/components/frozen-boxes";
import type { FrozenInfo } from "@/lib/commerce";

const T = {
  de: { loading: "Warenkorb wird geladen …", empty: "Dein Warenkorb ist leer", emptySub: "Stöbere in unseren Kategorien oder fang mit den Kundenlieblingen an.", start: "Zum Shop", cart: "Warenkorb", each: "pro Stück", remove: "Entfernen", subtotal: "Zwischensumme", checkout: "Zur Kasse", note: "Versand wird an der Kasse berechnet. Alle Preise inkl. MwSt.", frozen: "Tiefkühl" },
  en: { loading: "Loading cart…", empty: "Your cart is empty", emptySub: "Browse the categories or start with customer favourites.", start: "Go to the shop", cart: "Cart", each: "each", remove: "Remove", subtotal: "Subtotal", checkout: "Checkout", note: "Delivery is calculated at checkout. All prices incl. VAT.", frozen: "Frozen" },
};

export function CartView({ lang, frozen, perks }: { lang: "de" | "en"; frozen: FrozenInfo; perks: CartPerks }) {
  const { lines, subtotal, setQty, remove, ready } = useCart();
  const t = T[lang];
  if (!ready) return <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted">{t.loading}</div>;
  if (!lines.length)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="h-section">{t.empty}</h1>
        <p className="mt-2 text-sm text-muted">{t.emptySub}</p>
        <Link href="/shop" className="btn btn-primary mt-8">{t.start}</Link>
      </div>
    );
  const ids = lines.map((l) => l.id);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      <h1 className="h-section">{t.cart}</h1>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-4 py-5">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.image_url && <img src={img(l.image_url, 200)} alt="" className="h-full w-full object-cover mix-blend-multiply" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${l.slug}`} className="line-clamp-2 text-sm hover:underline">{l.title}</Link>
                <div className="mt-1 text-xs text-muted">{money(l.price)} {t.each}{l.is_frozen ? ` · ${t.frozen}` : ""}</div>
                <button onClick={() => remove(l.id)} className="mt-1 text-xs text-muted hover:underline">{t.remove}</button>
              </div>
              <div className="flex items-center rounded-full border border-line text-sm">
                <button className="h-8 w-8" onClick={() => setQty(l.id, l.qty - 1)} aria-label={`− ${l.title}`}>−</button>
                <span className="w-6 text-center">{l.qty}</span>
                <button className="h-8 w-8" onClick={() => setQty(l.id, Math.min(99, l.qty + 1))} aria-label={`+ ${l.title}`}>+</button>
              </div>
              <div className="w-28 shrink-0"><LinePrice line={l} lang={lang} /></div>
            </li>
          ))}
          <GiftLine subtotal={subtotal} perks={perks} lang={lang} size="lg" />
        </ul>
        <aside className="h-fit space-y-5 lg:sticky lg:top-24">
          <div className="flex justify-between text-sm"><span>{t.subtotal}</span><span className="font-semibold">{money(subtotal)}</span></div>
          <PerksBar subtotal={subtotal} perks={perks} lang={lang} />
          <FrozenBoxes lines={lines} pack={frozen.pack} courier={frozen.courier} local={frozen.local} lang={lang} />
          <Link href="/checkout" className="btn btn-primary w-full py-3">{t.checkout}</Link>
          <p className="text-center text-[0.6875rem] text-muted">{t.note}</p>
        </aside>
      </div>
      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <RecipeSuggestions productIds={ids} lang={lang} />
        <Upsell ids={ids} lang={lang} layout="row" />
      </div>
    </div>
  );
}
