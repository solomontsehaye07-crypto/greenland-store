import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import { getCategories, getProductsInCategories } from "@/lib/catalog";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export const revalidate = 300;

async function load(slug: string) {
  const { data } = await supabasePublic().from("products").select("id, sku, slug, title, title_de, brand, description, category_id, price, compare_at_price, tax_rate, weight_g, size_qty, size_unit, image_url, images, country, is_frozen, age_restricted, is_dropship, status, featured, stock").eq("slug", slug).eq("status", "active").maybeSingle();
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
  const p = await load((await params).slug);
  if (!p) notFound();
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
    <div className="mx-auto max-w-7xl px-4 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-green">Home</Link>
        {parent && <> / <Link href={`/c/${parent.slug}`} className="hover:text-green">{parent.title}</Link></>}
        {cat && <> / <Link href={`/c/${cat.slug}`} className="hover:text-green">{cat.title}</Link></>}
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          {images.length ? (
            images.slice(0, 4).map((src, i) => (
              <div key={src} className={`overflow-hidden rounded-3xl bg-white ${i > 0 ? "hidden sm:block" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={i === 0 ? p.title : ""} className="mx-auto aspect-square w-full max-w-xl object-contain p-6" />
              </div>
            ))
          ) : (
            <div className="grid aspect-square place-items-center rounded-3xl bg-white text-muted">No photo yet</div>
          )}
        </div>
        <div className="lg:sticky lg:top-40 lg:self-start">
          {p.brand && <p className="text-sm font-semibold text-green">{p.brand}</p>}
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{p.title}</h1>
          {size && <p className="mt-2 text-muted">{size}</p>}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{money(p.price)}</span>
            {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
              <span className="text-lg text-muted line-through">{money(p.compare_at_price)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            incl. {Number(p.tax_rate)}% VAT, plus <Link href="/legal/versand" className="underline">shipping</Link>
            {base && <> · {base}</>}
          </p>
          <div className="mt-6">
            <AddToCart product={p} disabled={p.stock <= 0} />
          </div>
          <p className={`mt-3 text-sm font-medium ${p.stock > 0 ? "text-green" : "text-danger"}`}>
            {p.stock > 5 ? "In stock" : p.stock > 0 ? `Only ${p.stock} left` : "Out of stock – back soon"}
          </p>
          <ul className="mt-6 space-y-2 rounded-2xl bg-white p-5 text-sm">
            {p.is_frozen && <li><b>Frozen product.</b> Ships only by frozen express, local delivery or pickup.</li>}
            {p.age_restricted && <li><b>18+ only.</b> We check age on delivery and pickup.</li>}
            <li>Standard delivery 2–3 working days, free from 69 €.</li>
            <li>Free pickup in Kaiserslautern.</li>
          </ul>
          {p.description && (
            <div className="prose mt-8 max-w-none text-[0.95rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: p.description }} />
          )}
          <p className="mt-6 text-xs text-muted">SKU {p.sku}. Ingredients, allergens and nutrition values are printed on the pack; ask us on WhatsApp for a photo of the label.</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-3xl font-bold">More from {cat?.title}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
