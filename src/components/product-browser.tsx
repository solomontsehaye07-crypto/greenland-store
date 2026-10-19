import Link from "next/link";
import { browseProducts, getCategoryTree, getCountryCounts } from "@/lib/catalog";
import { countryFlag, countryLabel } from "@/lib/countries";
import { ui, type Lang } from "@/lib/i18n";
import { ProductGrid } from "./product-card";

export interface BrowseParams { sort?: string; page?: string; country?: string; sale?: string; stock?: string }

const SORTS = (lang: Lang) => [
  ["", ui("sortFeatured", lang)],
  ["new", ui("sortNew", lang)],
  ["price-asc", ui("sortPriceAsc", lang)],
  ["price-desc", ui("sortPriceDesc", lang)],
  ["name", ui("sortName", lang)],
];

/**
 * The product listing used by /shop and every category page: category list on the left (desktop),
 * country chips, sort and an in-stock toggle on top. Plain links and a GET form, so it works without JavaScript.
 */
export async function ProductBrowser({
  basePath,
  scopeIds,
  activeSlug,
  params,
  lang,
}: {
  basePath: string;
  scopeIds?: number[];
  activeSlug?: string;
  params: BrowseParams;
  lang: Lang;
}) {
  const country = params.country || undefined;
  const sale = params.sale === "1";
  const inStock = params.stock === "1";
  const [{ products, count, page, pages }, countries, tree] = await Promise.all([
    browseProducts({ scopeIds, country, sort: params.sort, page: Number(params.page) || 1, sale, inStock }),
    getCountryCounts(scopeIds),
    getCategoryTree(),
  ]);
  const qs = (patch: Partial<BrowseParams>) => {
    const p = new URLSearchParams();
    const merged = { ...params, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    if (!("page" in patch)) p.delete("page");
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const catTitle = (c: { title: string; title_de: string | null }) => (lang === "de" ? c.title_de || c.title : c.title);
  const keep = (extra: Record<string, string | undefined>) =>
    Object.entries({ country: params.country, sale: params.sale, stock: params.stock, ...extra }).filter(([, v]) => v) as [string, string][];

  return (
    <div className="grid gap-10 lg:grid-cols-[12.5rem_1fr]">
      <aside className="hidden lg:block" aria-label={ui("category", lang)}>
        <nav className="sticky top-24 space-y-5 text-[0.8125rem]">
          <Link href={`/shop${qs({})}`} className={`block ${!activeSlug ? "font-semibold" : "text-muted hover:text-ink"}`}>{ui("allCategories", lang)}</Link>
          {tree.map((d) => (
            <div key={d.id}>
              <Link href={`/c/${d.slug}${qs({})}`} className={`block ${activeSlug === d.slug ? "font-semibold" : "font-medium hover:underline"}`}>{catTitle(d)}</Link>
              <ul className="mt-1.5 space-y-1 border-l border-line pl-3">
                {d.children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/c/${c.slug}${qs({})}`} className={activeSlug === c.slug ? "font-semibold text-ink" : "text-muted hover:text-ink"}>{catTitle(c)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-xs text-muted">{count} {ui("products", lang)}</p>
          <form className="flex flex-wrap items-center gap-3 text-xs" action={basePath}>
            {keep({}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <label className="flex items-center gap-2">
              <span className="text-muted">{ui("sortBy", lang)}</span>
              <select name="sort" defaultValue={params.sort ?? ""} className="rounded-full border border-line bg-white px-3 py-1.5">
                {SORTS(lang).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <button className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink">OK</button>
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto py-4 [scrollbar-width:none]">
          <Link href={`${basePath}${qs({ country: undefined })}`} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${!country ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{ui("allCountries", lang)}</Link>
          {countries.map((c) => (
            <Link key={c.country} href={`${basePath}${qs({ country: c.country })}`} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${country === c.country ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
              <span aria-hidden>{countryFlag(c.country)}</span>{countryLabel(c.country, lang)}
            </Link>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Link href={`${basePath}${qs({ sale: sale ? undefined : "1" })}`} className={`rounded-full border px-3 py-1.5 ${sale ? "border-terra bg-terra text-white" : "border-line bg-white hover:border-ink"}`}>{ui("offers", lang)}</Link>
          <Link href={`${basePath}${qs({ stock: inStock ? undefined : "1" })}`} className={`rounded-full border px-3 py-1.5 ${inStock ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{ui("onlyInStock", lang)}</Link>
          {(country || sale || inStock || params.sort) && <Link href={basePath} className="px-2 py-1.5 text-muted underline">{ui("reset", lang)}</Link>}
        </div>

        {products.length ? <ProductGrid products={products} lang={lang} /> : <p className="py-20 text-center text-sm text-muted">{ui("noResults", lang)}</p>}

        {pages > 1 && (
          <nav className="mt-14 flex flex-wrap justify-center gap-1" aria-label={ui("page", lang)}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={`${basePath}${qs({ page: String(p) })}`} aria-current={p === page ? "page" : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-xs ${p === page ? "bg-ink text-white" : "hover:bg-surface"}`}>{p}</Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
