"use client";

import { img } from "@/lib/img";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "./cart";
import { money } from "@/lib/format";
import { GiftLine, LinePrice, PerksBar, Upsell } from "./cart-extras";
import type { CartPerks } from "@/lib/perks";
import { RecipeSuggestions } from "./recipe-suggestions";
import { FrozenBoxes } from "./frozen-boxes";
import type { FrozenInfo } from "@/lib/commerce";

const T = {
  de: { cart: "Warenkorb", empty: "Dein Warenkorb ist leer.", close: "Schließen", subtotal: "Zwischensumme", checkout: "Zur Kasse", view: "Warenkorb ansehen", remove: "Entfernen", note: "Inkl. MwSt., zzgl. Versand" },
  en: { cart: "Cart", empty: "Your cart is empty.", close: "Close", subtotal: "Subtotal", checkout: "Checkout", view: "View cart", remove: "Remove", note: "Incl. VAT, plus delivery" },
};

export function CartDrawer({ lang, frozen, perks }: { lang: "de" | "en"; frozen: FrozenInfo; perks: CartPerks }) {
  const { lines, subtotal, setQty, remove, drawerOpen, setDrawerOpen } = useCart();
  const t = T[lang];
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <div className={`fixed inset-0 z-50 ${drawerOpen ? "" : "pointer-events-none"}`} aria-hidden={!drawerOpen}>
      <div className={`absolute inset-0 bg-ink/25 transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setDrawerOpen(false)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.cart}
        tabIndex={-1}
        className={`absolute right-0 top-0 flex h-full w-full max-w-[26rem] flex-col bg-white shadow-2xl outline-none transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{t.cart} <span className="text-muted">({lines.reduce((s, l) => s + l.qty, 0)})</span></h2>
          <button type="button" onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface" aria-label={t.close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {drawerOpen && (
          <div className="flex-1 overflow-y-auto px-5">
            {lines.length ? (
              <>
                <div className="space-y-3 py-4">
                  <PerksBar subtotal={subtotal} perks={perks} lang={lang} />
                  <FrozenBoxes lines={lines} pack={frozen.pack} courier={frozen.courier} local={frozen.local} lang={lang} compact />
                </div>
                <ul className="divide-y divide-line border-y border-line">
                  {lines.map((l) => (
                    <li key={l.id} className="flex gap-3 py-3.5">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.image_url && <img src={img(l.image_url, 160)} alt="" className="h-full w-full object-cover mix-blend-multiply" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/p/${l.slug}`} onClick={() => setDrawerOpen(false)} className="line-clamp-2 text-[0.8125rem] leading-snug hover:underline">{l.title}</Link>
                        <div className="mt-2 flex items-start justify-between gap-2">
                          <div className="flex items-center rounded-full border border-line text-xs">
                            <button className="h-7 w-7" onClick={() => setQty(l.id, l.qty - 1)} aria-label="−">−</button>
                            <span className="w-5 text-center">{l.qty}</span>
                            <button className="h-7 w-7" onClick={() => setQty(l.id, Math.min(99, l.qty + 1))} aria-label="+">+</button>
                          </div>
                          <LinePrice line={l} lang={lang} />
                        </div>
                        <button onClick={() => remove(l.id)} className="mt-1 text-[0.6875rem] text-muted underline-offset-2 hover:underline">{t.remove}</button>
                      </div>
                    </li>
                  ))}
                  <GiftLine subtotal={subtotal} perks={perks} lang={lang} />
                </ul>
                <div className="space-y-8 py-6">
                  <RecipeSuggestions productIds={lines.map((l) => l.id)} lang={lang} compact />
                  <Upsell ids={lines.map((l) => l.id)} lang={lang} />
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted">{t.empty}</p>
            )}
          </div>
        )}
        {lines.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <div className="flex justify-between text-sm"><span>{t.subtotal}</span><span className="font-semibold">{money(subtotal)}</span></div>
            <p className="mt-0.5 text-[0.6875rem] text-muted">{t.note}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/cart" onClick={() => setDrawerOpen(false)} className="btn btn-ghost">{t.view}</Link>
              <Link href="/checkout" onClick={() => setDrawerOpen(false)} className="btn btn-primary">{t.checkout}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
