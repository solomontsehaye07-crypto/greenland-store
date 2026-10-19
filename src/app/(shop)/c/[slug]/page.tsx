import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categoryScope, getCategories } from "@/lib/catalog";
import { ProductBrowser, type BrowseParams } from "@/components/product-browser";
import { getLang, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const c = (await getCategories()).find((x) => x.slug === slug);
  return c ? { title: (lang === "de" && c.title_de) || c.title } : {};
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<BrowseParams> }) {
  const [{ slug }, sp, lang] = await Promise.all([params, searchParams, getLang()]);
  const scope = await categoryScope(slug);
  if (!scope) notFound();
  const cats = await getCategories();
  const cat = scope.category;
  const parent = cat.parent_id ? cats.find((c) => c.id === cat.parent_id) : null;
  const t = (c: { title: string; title_de: string | null }) => (lang === "de" && c.title_de) || c.title;
  const desc = lang === "de" ? (cat as { description_de?: string | null }).description_de || cat.description : cat.description;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">{ui("home", lang)}</Link>
        <span className="px-1.5">/</span>
        <Link href="/shop" className="hover:text-ink">{ui("shop", lang)}</Link>
        {parent && (<><span className="px-1.5">/</span><Link href={`/c/${parent.slug}`} className="hover:text-ink">{t(parent)}</Link></>)}
      </nav>
      <h1 className="h-section mt-3">{t(cat)}</h1>
      {desc && <p className="mt-1.5 max-w-2xl text-sm text-muted">{desc}</p>}
      <div className="mt-8">
        <ProductBrowser basePath={`/c/${slug}`} scopeIds={scope.ids} activeSlug={slug} params={sp} lang={lang} />
      </div>
    </div>
  );
}
