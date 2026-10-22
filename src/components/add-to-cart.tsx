"use client";

import { useState } from "react";
import { useCart } from "./cart";
import type { CardProduct } from "@/lib/catalog";
import type { CartLine } from "@/lib/types";

const T = {
  de: { add: (t: string) => `${t} in den Warenkorb`, out: "Ausverkauft", added: "Im Warenkorb", cta: "In den Warenkorb", less: "Weniger", more: "Mehr" },
  en: { add: (t: string) => `Add ${t} to cart`, out: "Out of stock", added: "Added to cart", cta: "Add to cart", less: "Decrease quantity", more: "Increase quantity" },
};

export function toLine(p: CardProduct): Omit<CartLine, "qty"> {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    title: p.title,
    price: Number(p.price),
    image_url: p.image_url,
    weight_g: p.weight_g,
    is_frozen: p.is_frozen,
    age_restricted: p.age_restricted,
    qd: p.qty_discount !== false,
  };
}

/**
 * compact: the small round "+" on product cards.
 * inline: a text button for lists such as the cart's add-ons (does not reopen the cart panel).
 */
export function AddToCart({
  product,
  disabled,
  compact,
  inline,
  block,
  lang = "de",
}: {
  product: CardProduct;
  disabled?: boolean;
  compact?: boolean;
  inline?: boolean;
  block?: boolean; // full-width pill (product cards)
  lang?: "de" | "en";
}) {
  const t = T[lang];
  const { add, setDrawerOpen } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const onAdd = () => {
    add(toLine(product), compact || inline || block ? 1 : qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    if (!inline) setDrawerOpen(true);
  };

  if (inline)
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={t.add(product.title)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${added ? "border-forest bg-forest text-white" : "border-line bg-white hover:border-ink"}`}
      >
        {added ? "✓" : "+ " + (lang === "de" ? "Dazu" : "Add")}
      </button>
    );

  if (block)
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={t.add(product.title)}
        className={`card-add ${added ? "is-added" : ""}`}
      >
        {disabled ? t.out : added ? t.added : t.cta}
      </button>
    );

  if (compact)
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={t.add(product.title)}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40 ${added ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-ink"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          {added ? <path d="M5 12l5 5L20 7" /> : <path d="M12 5v14M5 12h14" />}
        </svg>
      </button>
    );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full border border-line bg-white">
        <button type="button" className="h-11 w-10 text-base text-muted hover:text-ink" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.less}>−</button>
        <span className="w-7 text-center text-sm font-medium" aria-live="polite">{qty}</span>
        <button type="button" className="h-11 w-10 text-base text-muted hover:text-ink" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={t.more}>+</button>
      </div>
      <button type="button" onClick={onAdd} disabled={disabled} className="btn btn-primary h-11 flex-1 sm:flex-none sm:px-10">
        {disabled ? t.out : added ? t.added : t.cta}
      </button>
    </div>
  );
}
