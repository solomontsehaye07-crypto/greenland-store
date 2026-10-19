import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getProductsInCategories } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { getLang, ui, type Lang } from "@/lib/i18n";

const ct = (c: { title: string; title_de?: string | null }, lang: Lang) => (lang === "de" && c.title_de) || c.title;

// Always rendered fresh, so prices and stock are current (Cloudflare has no page cache configured).
export const dynamic = "force-dynamic";
const PAGE = 48;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategories()).find((x) => x.slug === slug);
  return c ? { title: c.title, description: c.description ?? `${c.title} – ${c.title_de ?? ""} at Greenland Afro Asia Store` } : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const [{ slug }, { sort, page }, lang] = await Promise.all([params, searchParams, getLang()]);
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) notFound();
  const parent = cat.parent_id ? cats.find((c) => c.id === cat.parent_id) : null;
  const root = parent ?? cat;
  const siblings = cats.filter((c) => c.parent_id === root.id);
  const ids = cat.parent_id ? [cat.id] : [cat.id, ...siblings.map((s) => s.id)];
  const pageNo = Math.max(1, Number(page ?? 1));
  const { products, count } = await getProductsInCategories(ids, { sort, limit: PAGE, offset: (pageNo - 1) * PAGE });
  const pages = Math.ceil(count / PAGE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sort ? { sort } : {}), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-green">{ui("home", lang)}</Link>
        {parent && (
          <>
            {" / "}
            <Link href={`/c/${parent.slug}`} className="hover:text-green">{ct(parent, lang)}</Link>
          </>
        )}
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-extrabold sm:text-5xl">{ct(cat, lang)}</h1>
          {cat.title_de && <p className="mt-1 text-muted">{lang === "de" ? cat.title : cat.title_de}</p>}
        </div>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="sort" className="text-muted">{ui("sortBy", lang)}</label>
          <select id="sort" name="sort" defaultValue={sort ?? ""} className="input w-auto py-2">
            <option value="">{ui("sortFeatured", lang)}</option>
            <option value="price-asc">{ui("sortPriceAsc", lang)}</option>
            <option value="price-desc">{ui("sortPriceDesc", lang)}</option>
            <option value="name">{ui("sortName", lang)}</option>
          </select>
          <button className="btn btn-ghost py-2">OK</button>
        </form>
      </div>

      <ul className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <li>
          <Link href={`/c/${root.slug}`} className={`inline-block whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${cat.id === root.id ? "bg-ink text-paper" : "bg-white hover:bg-surface"}`}>
            {ui("allProducts", lang)}
          </Link>
        </li>
        {siblings.map((s) => (
          <li key={s.id}>
            <Link href={`/c/${s.slug}`} className={`inline-block whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${s.id === cat.id ? "bg-ink text-paper" : "bg-white hover:bg-surface"}`}>
              {ct(s, lang)}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mb-6 mt-6 text-sm text-muted">{count} {ui("products", lang)}</p>
      {products.length ? <ProductGrid products={products} lang={lang} /> : <p className="py-16 text-center text-muted">{ui("noResults", lang)}</p>}

      {pages > 1 && (
        <nav className="mt-12 flex justify-center gap-2" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={qs(p)} aria-current={p === pageNo ? "page" : undefined} className={`grid h-10 w-10 place-items-center rounded-full text-sm ${p === pageNo ? "bg-forest text-white" : "bg-white hover:bg-surface"}`}>
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
