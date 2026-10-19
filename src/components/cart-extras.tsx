"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CardProduct } from "@/lib/catalog";
import { money } from "@/lib/format";
import { AddToCart } from "./add-to-cart";

const T = {
  de: { title: "Passt gut dazu", sub: "Kleinigkeiten, die oft mitgenommen werden" },
  en: { title: "Add to your order", sub: "Small things people often pick up too" },
};

/** "Add to your order": suggestions for what is in the cart, excluding what is already there. */
export function Upsell({ ids, lang, layout = "list" }: { ids: number[]; lang: "de" | "en"; layout?: "list" | "row" }) {
  const [items, setItems] = useState<CardProduct[] | null>(null);
  const key = [...ids].sort((a, b) => a - b).join(",");
  useEffect(() => {
    let alive = true;
    fetch(`/api/upsell?ids=${key}`)
      .then((r) => r.json())
      .then((d) => alive && setItems(d.products ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [key]);
  if (!items?.length) return null;
  const title = (p: CardProduct) => (lang === "de" ? p.title_de || p.title : p.title);
  return (
    <section aria-label={T[lang].title}>
      <h3 className="text-sm font-semibold">{T[lang].title}</h3>
      <p className="text-xs text-muted">{T[lang].sub}</p>
      <ul className={layout === "row" ? "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4" : "mt-3 divide-y divide-line"}>
        {items.slice(0, layout === "row" ? 8 : 4).map((p) =>
          layout === "row" ? (
            <li key={p.id} className="flex flex-col">
              <Link href={`/p/${p.slug}`} className="block aspect-square overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />}
              </Link>
              <Link href={`/p/${p.slug}`} className="mt-2 line-clamp-2 text-xs leading-snug hover:underline">{title(p)}</Link>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-xs font-semibold">{money(p.price)}</span>
                <AddToCart product={p} inline lang={lang} />
              </div>
            </li>
          ) : (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <Link href={`/p/${p.slug}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${p.slug}`} className="line-clamp-1 text-xs hover:underline">{title(p)}</Link>
                <span className="text-xs font-semibold">{money(p.price)}</span>
              </div>
              <AddToCart product={p} inline lang={lang} />
            </li>
          )
        )}
      </ul>
    </section>
  );
}

export const FREE_FROM = 69;

export function FreeShippingBar({ subtotal, lang }: { subtotal: number; lang: "de" | "en" }) {
  const left = Math.max(0, FREE_FROM - subtotal);
  return (
    <div>
      <p className="text-xs text-muted">
        {left > 0
          ? lang === "de" ? `Noch ${money(left)} bis zum kostenlosen Versand` : `${money(left)} away from free delivery`
          : lang === "de" ? "Kostenloser Versand ist freigeschaltet" : "Free delivery unlocked"}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / FREE_FROM) * 100)}%` }} />
      </div>
    </div>
  );
}
