"use client";

import { useState } from "react";
import { useCart } from "./cart";
import { toLine } from "./add-to-cart";
import { money } from "@/lib/format";
import { discounted, tierPct, type TierConfig } from "@/lib/tiers";
import type { CardProduct } from "@/lib/catalog";

const T = {
  de: { piece: "Stück", from: "ab", save: "sparen", cta: "In den Warenkorb", added: "Im Warenkorb", out: "Ausverkauft", qty: "Menge", less: "Weniger", more: "Mehr", each: "pro Stück", tiersTitle: "Mengenrabatt" },
  en: { piece: "pc", from: "from", save: "save", cta: "Add to cart", added: "Added to cart", out: "Out of stock", qty: "Quantity", less: "Fewer", more: "More", each: "each", tiersTitle: "Quantity discount" },
};

/** Price, quantity-discount choices, quantity and the add button on the product page. */
export function BuyBox({ product, tiers, lang, compareAt }: { product: CardProduct; tiers: TierConfig; lang: "de" | "en"; compareAt?: number | null }) {
  const t = T[lang];
  const { add, setDrawerOpen } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const out = product.stock <= 0;
  const max = Math.max(1, Math.min(99, product.stock > 0 ? product.stock : 99));
  const eligible = product.qty_discount !== false && tiers.enabled && tiers.tiers.length > 0;
  const price = Number(product.price);
  const pct = tierPct(qty, tiers, eligible);
  const unit = discounted(price, pct);
  const options = eligible ? [{ min: 1, pct: 0 }, ...tiers.tiers.filter((x) => x.min <= max)] : [];

  const onAdd = () => {
    add(toLine(product), qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    setDrawerOpen(true);
  };

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[1.75rem] font-semibold tabular-nums leading-none">{money(unit)}</span>
        {(pct > 0 || (compareAt && compareAt > price)) && <span className="text-sm text-muted line-through tabular-nums">{money(pct > 0 ? price : compareAt)}</span>}
        {pct > 0 && <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-semibold text-white">−{pct} %</span>}
      </div>

      {options.length > 1 && (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-ink">{t.tiersTitle}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.map((o) => {
              const active = pct === o.pct && (o.min === 1 ? pct === 0 : true);
              return (
                <button
                  key={o.min}
                  type="button"
                  disabled={out}
                  onClick={() => setQty(o.min)}
                  aria-pressed={active}
                  className={`rounded-xl border px-2 py-2 text-left transition-colors disabled:opacity-50 ${active ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-line bg-white hover:border-ink/40"}`}
                >
                  <span className="block text-xs text-muted">{o.min === 1 ? `1 ${t.piece}` : `${t.from} ${o.min} ${t.piece}`}</span>
                  <span className="block text-sm font-semibold tabular-nums">{money(discounted(price, o.pct))}</span>
                  <span className={`block text-[0.6875rem] font-semibold ${o.pct ? "text-forest" : "text-transparent"}`}>{o.pct ? `−${o.pct} %` : "–"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex gap-3">
        <div className="flex h-12 items-center rounded-full border border-line bg-white" role="group" aria-label={t.qty}>
          <button type="button" className="h-12 w-11 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || out} aria-label={t.less}>−</button>
          <input
            value={qty}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value.replace(/\D/g, "")));
              setQty(Number.isFinite(n) && n > 0 ? Math.min(max, n) : 1);
            }}
            inputMode="numeric"
            aria-label={t.qty}
            disabled={out}
            className="w-10 bg-transparent text-center text-base font-semibold tabular-nums outline-none"
          />
          <button type="button" className="h-12 w-11 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max || out} aria-label={t.more}>+</button>
        </div>
        <button type="button" onClick={onAdd} disabled={out} className={`btn h-12 flex-1 text-base ${added ? "bg-forest text-white" : "btn-primary"}`}>
          {out ? t.out : added ? `✓ ${t.added}` : <span className="whitespace-nowrap">{t.cta}<span className="hidden min-[420px]:inline"> · {money(unit * qty)}</span></span>}
        </button>
      </div>
    </div>
  );
}
