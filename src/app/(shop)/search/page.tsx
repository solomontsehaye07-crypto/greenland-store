import { searchProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { getLang, ui } from "@/lib/i18n";

export const metadata = { title: "Suche / Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, lang] = await Promise.all([searchParams, getLang()]);
  const results = q ? await searchProducts(q) : [];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10">
      <form role="search" className="max-w-xl">
        <label htmlFor="sq" className="display text-4xl font-extrabold">{ui("search", lang)}</label>
        <input id="sq" name="q" defaultValue={q} autoFocus placeholder={ui("searchPlaceholder", lang)} className="input mt-4 rounded-full py-3 text-base" />
      </form>
      {q && <p className="mb-6 mt-6 text-sm text-muted">{results.length} {ui("results", lang)} · “{q}”</p>}
      {q && !results.length && <p className="py-12 text-muted">{ui("noResults", lang)}</p>}
      <ProductGrid products={results} lang={lang} />
    </div>
  );
}
