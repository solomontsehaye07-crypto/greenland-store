"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./cart";
import { money } from "@/lib/format";
import type { RecipeItem, RecipeSuggestion } from "@/lib/recipes";
import type { CardProduct } from "@/lib/catalog";

type Lang = "de" | "en";
type Text = { de?: string; en?: string } | null | undefined;
const t = (v: Text, lang: Lang) => (v ? (lang === "en" ? v.en || v.de : v.de || v.en) ?? "" : "");

const COPY = {
  de: { heading: "Passt dazu – Rezeptideen", add: "Hinzufügen", added: "Im Warenkorb", addAll: "Alle hinzufügen", allAdded: "Alle im Warenkorb", recipe: "Zum Rezept", optional: "optional" },
  en: { heading: "Goes well together – recipe ideas", add: "Add", added: "Added", addAll: "Add all", allAdded: "All added", recipe: "View recipe", optional: "optional" },
};

function toLine(p: CardProduct) {
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
  };
}

function ItemRow({ item, lang, inCart, onAdd }: { item: RecipeItem; lang: Lang; inCart: boolean; onAdd: () => void }) {
  const c = COPY[lang];
  const p = item.product;
  const title = (lang === "de" && p.title_de) || p.title;
  const note = t(item.note, lang) || (!item.essential ? c.optional : "");
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={`/p/${p.slug}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
        {p.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/p/${p.slug}`} className="line-clamp-1 text-sm hover:underline">{title}</Link>
        <div className="text-xs text-muted">
          {money(p.price)}
          {note && <> · {note}</>}
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={inCart}
        className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-[var(--forest)] hover:text-[var(--forest)] disabled:border-transparent disabled:text-muted"
      >
        {inCart ? c.added : c.add}
      </button>
    </li>
  );
}

/** Presentational list of recipe suggestions; shared by the cart (client fetch) and product page (server data). */
export function RecipeList({ recipes, lang, compact = false }: { recipes: RecipeSuggestion[]; lang: Lang; compact?: boolean }) {
  const c = COPY[lang];
  const { add, lines } = useCart();
  const inCart = new Set(lines.map((l) => l.id));
  if (!recipes.length) return null;
  return (
    <section aria-labelledby="recipe-ideas" className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 id="recipe-ideas" className="text-base font-semibold">{c.heading}</h2>
      <div className={`mt-4 grid gap-6 ${compact ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {recipes.map((r) => {
          const missing = r.missing.filter((m) => !inCart.has(m.product.id));
          const allIn = missing.length === 0;
          return (
            <article key={r.slug} className="min-w-0">
              <div className="flex items-center gap-3">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-surface object-cover" />
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    <Link href={`/rezepte/${r.slug}`} className="hover:underline">{t(r.title, lang)}</Link>
                  </h3>
                  <p className="line-clamp-1 text-xs text-muted">{t(r.intro, lang)}</p>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {r.missing.map((m) => (
                  <ItemRow key={m.product.id} item={m} lang={lang} inCart={inCart.has(m.product.id)} onAdd={() => add(toLine(m.product))} />
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Link href={`/rezepte/${r.slug}`} className="text-xs text-muted underline-offset-2 hover:underline">{c.recipe}</Link>
                <button
                  type="button"
                  disabled={allIn}
                  onClick={() => missing.forEach((m) => add(toLine(m.product)))}
                  className="rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--forest)" }}
                >
                  {allIn ? c.allAdded : c.addAll}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Fetches recipe ideas for the given products (e.g. what's in the cart) and shows what's still missing. */
export function RecipeSuggestions({ productIds, lang, compact }: { productIds: number[]; lang: Lang; compact?: boolean }) {
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const key = [...new Set(productIds)].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!key) {
      setRecipes([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/recipes?ids=${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { recipes: [] }))
      .then((d) => setRecipes(d.recipes ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);
  return <RecipeList recipes={recipes} lang={lang} compact={compact} />;
}

/** "Add all ingredients" button for the recipe detail page. */
export function AddAllButton({ products, lang }: { products: CardProduct[]; lang: Lang }) {
  const c = COPY[lang];
  const { add, lines } = useCart();
  const inCart = new Set(lines.map((l) => l.id));
  const missing = products.filter((p) => !inCart.has(p.id));
  return (
    <button
      type="button"
      disabled={!missing.length}
      onClick={() => missing.forEach((p) => add(toLine(p)))}
      className="rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      style={{ background: "var(--forest)" }}
    >
      {missing.length ? c.addAll : c.allAdded}
    </button>
  );
}

/** Single add button for an ingredient row on the recipe page. */
export function AddOneButton({ product, lang }: { product: CardProduct; lang: Lang }) {
  const c = COPY[lang];
  const { add, lines } = useCart();
  const inCart = lines.some((l) => l.id === product.id);
  return (
    <button
      type="button"
      onClick={() => add(toLine(product))}
      disabled={inCart}
      className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-[var(--forest)] hover:text-[var(--forest)] disabled:border-transparent disabled:text-muted"
    >
      {inCart ? c.added : c.add}
    </button>
  );
}
