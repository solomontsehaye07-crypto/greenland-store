import { searchProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = q ? await searchProducts(q) : [];
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8">
      <form role="search" className="max-w-xl">
        <label htmlFor="sq" className="text-4xl font-extrabold display">
          Search
        </label>
        <input id="sq" name="q" defaultValue={q} autoFocus placeholder="Try ‘gari’, ‘shea’, ‘jebena’…" className="input mt-4 rounded-full py-3 text-base" />
      </form>
      {q && (
        <p className="mb-6 mt-6 text-sm text-muted">
          {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}
      {q && !results.length && <p className="py-12 text-muted">No products match “{q}”. Check the spelling or browse a category above.</p>}
      <ProductGrid products={results} />
    </div>
  );
}
