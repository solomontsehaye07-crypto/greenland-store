"use client";

import { useState } from "react";
import { useCart } from "./cart";
import type { CardProduct } from "@/lib/catalog";

const T = {
  de: { add: (t: string) => `${t} in den Warenkorb`, out: "Ausverkauft", added: "Im Warenkorb", cta: "In den Warenkorb", less: "Weniger", more: "Mehr" },
  en: { add: (t: string) => `Add ${t} to cart`, out: "Out of stock", added: "Added to cart", cta: "Add to cart", less: "Decrease quantity", more: "Increase quantity" },
};

export function AddToCart({ product, disabled, compact, lang = "de" }: { product: CardProduct; disabled?: boolean; compact?: boolean; lang?: "de" | "en" }) {
  const t = T[lang];
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const onAdd = () => {
    add(
      {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        title: product.title,
        price: Number(product.price),
        image_url: product.image_url,
        weight_g: product.weight_g,
        is_frozen: product.is_frozen,
        age_restricted: product.age_restricted,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  if (compact)
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={t.add(product.title)}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-all hover:scale-105 disabled:opacity-40 ${added ? "bg-saffron text-ink" : "bg-forest"}`}
      >
        {added ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
    );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full border border-line bg-white">
        <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.less}>
          −
        </button>
        <span className="w-8 text-center font-semibold" aria-live="polite">
          {qty}
        </span>
        <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={t.more}>
          +
        </button>
      </div>
      <button type="button" onClick={onAdd} disabled={disabled} className="btn btn-primary h-11 flex-1 sm:flex-none sm:px-8">
        {disabled ? t.out : added ? t.added : t.cta}
      </button>
    </div>
  );
}
