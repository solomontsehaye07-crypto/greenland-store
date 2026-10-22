import { searchProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { getLang, ui } from "@/lib/i18n";
import { SearchBox } from "@/components/search-box";

export const metadata = { title: "Suche / Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, lang] = await Promise.all([searchParams, getLang()]);
  const results = q ? await searchProducts(q) : [];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10">
      <div className="max-w-xl">
        <h1 className="h-section">{ui("search", lang)}</h1>
        <div className="mt-4">
          <SearchBox lang={lang} variant="page" defaultValue={q} autoFocus label={ui("search", lang)} placeholder={ui("searchPlaceholder", lang)} />
        </div>
      </div>
      {q && <p className="mb-8 mt-6 text-xs text-muted">{results.length} {ui("results", lang)} · “{q}”</p>}
      {q && !results.length && <p className="py-12 text-muted">{ui("noResults", lang)}</p>}
      <ProductGrid products={results} lang={lang} />
    </div>
  );
}
