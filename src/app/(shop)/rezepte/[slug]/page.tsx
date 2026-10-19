import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRecipe } from "@/lib/recipes";
import { getLang, tx } from "@/lib/i18n";
import { countryLabel } from "@/lib/countries";
import { money } from "@/lib/format";
import { AddAllButton, AddOneButton } from "@/components/recipe-suggestions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const r = await getRecipe(slug);
  return r ? { title: tx(r.title, lang), description: tx(r.intro, lang) } : {};
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const r = await getRecipe(slug);
  if (!r) notFound();
  const de = lang === "de";
  const total = r.items.reduce((s, i) => s + Number(i.product.price), 0);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/rezepte" className="hover:underline">{de ? "Rezepte" : "Recipes"}</Link>
      </nav>
      <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div className="aspect-square overflow-hidden rounded-xl bg-surface">
          {r.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          {r.country && <div className="text-xs text-muted">{countryLabel(r.country, lang, true)}</div>}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{tx(r.title, lang)}</h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">{tx(r.intro, lang)}</p>

          <div className="mt-10 flex items-end justify-between gap-4 border-b border-line pb-3">
            <h2 className="text-sm font-semibold">{de ? "Zutaten aus dem Shop" : "Ingredients from the shop"}</h2>
            <span className="text-xs text-muted">{r.items.length} · {money(total)}</span>
          </div>
          <ul className="divide-y divide-line">
            {r.items.map((i) => {
              const p = i.product;
              const note = tx(i.note, lang) || (!i.essential ? (de ? "optional" : "optional") : "");
              return (
                <li key={p.id} className="flex items-center gap-4 py-3">
                  <Link href={`/p/${p.slug}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${p.slug}`} className="line-clamp-1 text-sm hover:underline">{(de && p.title_de) || p.title}</Link>
                    <div className="text-xs text-muted">{money(p.price)}{note && <> · {note}</>}</div>
                  </div>
                  <AddOneButton product={p} lang={lang} />
                </li>
              );
            })}
          </ul>
          <div className="mt-6">
            <AddAllButton products={r.items.map((i) => i.product)} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
