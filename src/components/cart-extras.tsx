"use client";

import { img } from "@/lib/img";

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
                {p.image_url && <img src={img(p.image_url, 160)} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />}
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
                {p.image_url && <img src={img(p.image_url, 160)} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />}
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

type Perks = import("@/lib/perks").CartPerks;

const P = {
  de: { ship: "Kostenloser Versand", gift: "Gratis-Geschenk", toShip: (m: string) => `Noch ${m} bis zum kostenlosen Versand`, toGift: (m: string) => `Noch ${m} bis zu deinem Gratis-Geschenk`, all: "Kostenloser Versand und Gratis-Geschenk sind freigeschaltet", shipDone: "Kostenloser Versand ist freigeschaltet", giftDone: "Dein Gratis-Geschenk ist freigeschaltet", free: "Gratis", yours: "Geschenk für dich" },
  en: { ship: "Free delivery", gift: "Free gift", toShip: (m: string) => `${m} away from free delivery`, toGift: (m: string) => `${m} away from your free gift`, all: "Free delivery and your free gift are unlocked", shipDone: "Free delivery unlocked", giftDone: "Your free gift is unlocked", free: "Free", yours: "A gift for you" },
};

/** One progress bar with a stop for free delivery and one for the free gift (whichever are set up). */
export function PerksBar({ subtotal, perks, lang }: { subtotal: number; perks: Perks; lang: "de" | "en" }) {
  const t = P[lang];
  const stops = [
    ...(perks.freeFrom ? [{ at: perks.freeFrom, kind: "ship" as const }] : []),
    ...(perks.gift ? [{ at: perks.gift.threshold, kind: "gift" as const }] : []),
  ].sort((a, b) => a.at - b.at);
  if (!stops.length) return null;
  const max = stops[stops.length - 1].at;
  const next = stops.find((s) => subtotal < s.at);
  const msg = next
    ? (next.kind === "ship" ? t.toShip : t.toGift)(money(next.at - subtotal))
    : stops.length > 1 ? t.all : stops[0].kind === "ship" ? t.shipDone : t.giftDone;
  return (
    <div>
      <p className={`text-xs ${next ? "text-muted" : "font-semibold text-forest"}`} role="status">{msg}</p>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-line">
        <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / max) * 100)}%` }} />
        {stops.map((s) => {
          const done = subtotal >= s.at;
          return (
            <span
              key={s.kind}
              title={`${s.kind === "ship" ? t.ship : t.gift} · ${money(s.at)}`}
              className={`absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition-colors ${done ? "border-forest bg-forest text-white" : "border-line bg-white text-muted"}`}
              style={{ left: `${Math.min(100, (s.at / max) * 100)}%`, ...(s.at === max ? { left: "calc(100% - 0.75rem)" } : {}) }}
            >
              {s.kind === "ship" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z" /></svg>
              )}
            </span>
          );
        })}
      </div>
      <div className="relative mt-2 h-4 text-[0.6875rem] text-muted">
        {stops.map((s) => (
          <span key={s.kind} className="absolute whitespace-nowrap" style={{ left: `${Math.min(100, (s.at / max) * 100)}%`, translate: s.at === max ? "-100% 0" : "-50% 0" }}>
            <span className="sr-only">{s.kind === "ship" ? t.ship : t.gift} </span>{money(s.at)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The free gift as its own cart row once unlocked (it is added to the order on the server). */
export function GiftLine({ subtotal, perks, lang, size = "sm" }: { subtotal: number; perks: Perks; lang: "de" | "en"; size?: "sm" | "lg" }) {
  const g = perks.gift;
  if (!g || subtotal < g.threshold) return null;
  const t = P[lang];
  const name = lang === "de" ? g.title_de || g.title : g.title;
  const box = size === "lg" ? "h-20 w-20 rounded-lg" : "h-16 w-16 rounded-md";
  return (
    <li className={`flex items-center gap-3 ${size === "lg" ? "gap-4 py-5" : "py-3.5"}`}>
      <div className={`relative shrink-0 overflow-hidden bg-surface ${box}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {g.image_url && <img src={img(g.image_url, 160)} alt="" className="h-full w-full object-cover mix-blend-multiply" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-saffron/30 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink">{t.yours}</span>
        <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug" data-no-translate>{name}</p>
      </div>
      <span className="text-right text-sm">
        <span className="block font-semibold text-forest">{t.free}</span>
        {g.value > 0 && <s className="text-[0.6875rem] text-muted">{money(g.value)}</s>}
      </span>
    </li>
  );
}
