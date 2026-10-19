import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import { getCategories, getProductsInCategories } from "@/lib/catalog";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";
import { getLang, ui } from "@/lib/i18n";

// Always rendered fresh, so prices and stock are current (Cloudflare has no page cache configured).
export const dynamic = "force-dynamic";

async function load(slug: string) {
  const { data } = await supabasePublic().from("products").select("id, sku, slug, title, title_de, brand, description, description_de, category_id, price, compare_at_price, tax_rate, weight_g, size_qty, size_unit, image_url, images, country, is_frozen, age_restricted, is_dropship, status, featured, stock").eq("slug", slug).eq("status", "active").maybeSingle();
  return data as Product | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description?.slice(0, 155) ?? `${p.title} – buy online at Greenland Afro Asia Store, Kaiserslautern.`,
    openGraph: { images: p.image_url ? [p.image_url] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const p = (await load(slug)) as (Product & { description_de?: string | null }) | null;
  if (!p) notFound();
  const de = lang === "de";
  const title = (de && p.title_de) || p.title;
  const desc = (de && p.description_de) || p.description;
  const catT = (c: { title: string; title_de?: string | null }) => (de && c.title_de) || c.title;
  const cats = await getCategories();
  const cat = cats.find((c) => c.id === p.category_id);
  const parent = cat?.parent_id ? cats.find((c) => c.id === cat.parent_id) : null;
  const related = cat ? (await getProductsInCategories([cat.id], { limit: 9 })).products.filter((x) => x.id !== p.id).slice(0, 4) : [];
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const images = p.images?.length ? p.images : p.image_url ? [p.image_url] : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    sku: p.sku,
    image: images,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-forest">{ui("home", lang)}</Link>
        {parent && <> / <Link href={`/c/${parent.slug}`} className="hover:text-forest">{catT(parent)}</Link></>}
        {cat && <> / <Link href={`/c/${cat.slug}`} className="hover:text-forest">{catT(cat)}</Link></>}
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          {images.length ? (
            images.slice(0, 4).map((src, i) => (
              <div key={src} className={`overflow-hidden rounded-3xl bg-white ${i > 0 ? "hidden sm:block" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={i === 0 ? title : ""} className="mx-auto aspect-square w-full max-w-xl object-contain p-6" />
              </div>
            ))
          ) : (
            <div className="grid aspect-square place-items-center rounded-3xl bg-white text-muted">{ui("noPhoto", lang)}</div>
          )}
        </div>
        <div className="lg:sticky lg:top-40 lg:self-start">
          {p.brand && <p className="text-sm font-semibold text-forest">{p.brand}</p>}
          <h1 className="display mt-1 text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {de && p.title_de && p.title_de !== p.title && <p className="mt-1 text-sm text-muted">{p.title}</p>}
          {size && <p className="mt-2 text-muted">{size}</p>}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{money(p.price)}</span>
            {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
              <span className="text-lg text-muted line-through">{money(p.compare_at_price)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {de ? <>inkl. {Number(p.tax_rate)} % MwSt., zzgl. <Link href="/legal/versand" className="underline">Versand</Link></> : <>incl. {Number(p.tax_rate)}% VAT, plus <Link href="/legal/versand" className="underline">shipping</Link></>}
            {base && <> · {base}</>}
          </p>
          <div className="mt-6">
            <AddToCart product={p} disabled={p.stock <= 0} lang={lang} />
          </div>
          <p className={`mt-3 text-sm font-medium ${p.stock > 0 ? "text-forest" : "text-danger"}`}>
            {p.stock > 5 ? ui("inStock", lang) : p.stock > 0 ? (de ? `Nur noch ${p.stock} Stück` : `Only ${p.stock} left`) : ui("outOfStock", lang)}
          </p>
          <ul className="mt-6 space-y-2 rounded-2xl bg-white p-5 text-sm">
            {p.is_frozen && <li><b>{de ? "Tiefkühlware." : "Frozen product."}</b> {de ? "Versand nur per Tiefkühl-Express, lokale Lieferung oder Abholung." : "Ships only by frozen express, local delivery or pickup."}</li>}
            {p.age_restricted && <li><b>{de ? "Ab 18." : "18+ only."}</b> {de ? "Wir prüfen das Alter bei Lieferung und Abholung." : "We check age on delivery and pickup."}</li>}
            <li>{de ? "Standardversand 2–3 Werktage, ab 69 € kostenlos." : "Standard delivery 2–3 working days, free from 69 €."}</li>
            <li>{de ? "Kostenlose Abholung in Kaiserslautern." : "Free pickup in Kaiserslautern."}</li>
          </ul>
          {desc && (
            <div className="prose mt-8 max-w-none text-[0.95rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: desc }} />
          )}
          <p className="mt-6 text-xs text-muted">SKU {p.sku}. {de ? "Zutaten, Allergene und Nährwerte stehen auf der Packung; schreib uns auf WhatsApp für ein Foto des Etiketts." : "Ingredients, allergens and nutrition values are printed on the pack; ask us on WhatsApp for a photo of the label."}</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="display mb-6 text-3xl font-bold">{de ? "Mehr aus" : "More from"} {cat ? catT(cat) : ""}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
