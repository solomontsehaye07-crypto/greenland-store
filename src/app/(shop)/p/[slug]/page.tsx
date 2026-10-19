import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import { getCategories, getProductsInCategories, getBestsellers } from "@/lib/catalog";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import { Rail } from "@/components/sections/rail";
import { ProductRecipes } from "@/components/recipe-suggestions-server";
import { countryFlag, countryLabel } from "@/lib/countries";
import type { Product } from "@/lib/types";
import { getLang, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type P = Product & { description_de?: string | null; also_countries?: string[] | null };

async function load(slug: string) {
  const { data } = await supabasePublic()
    .from("products")
    .select("id, sku, slug, title, title_de, brand, description, description_de, category_id, price, compare_at_price, tax_rate, weight_g, size_qty, size_unit, image_url, images, country, also_countries, is_frozen, age_restricted, is_dropship, status, featured, stock")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return data as P | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const p = await load(slug);
  if (!p) return {};
  const title = (lang === "de" && p.title_de) || p.title;
  const desc = ((lang === "de" && p.description_de) || p.description || "").replace(/<[^>]+>/g, " ").trim();
  return { title, description: desc.slice(0, 155) || undefined, openGraph: { images: p.image_url ? [p.image_url] : [] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, lang] = await Promise.all([params, getLang()]);
  const p = await load(slug);
  if (!p) notFound();
  const de = lang === "de";
  const title = (de && p.title_de) || p.title;
  const desc = (de && p.description_de) || p.description;
  const cats = await getCategories();
  const cat = cats.find((c) => c.id === p.category_id);
  const parent = cat?.parent_id ? cats.find((c) => c.id === cat.parent_id) : null;
  const catT = (c: { title: string; title_de: string | null }) => (de && c.title_de) || c.title;
  const [related, favourites] = await Promise.all([
    cat ? getProductsInCategories([cat.id], { limit: 13 }).then((r) => r.products.filter((x) => x.id !== p.id && x.stock > 0).slice(0, 10)) : Promise.resolve([]),
    getBestsellers(10),
  ]);
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const images = p.images?.length ? p.images : p.image_url ? [p.image_url] : [];
  const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    sku: p.sku,
    image: images,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: { "@type": "Offer", priceCurrency: "EUR", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  const facts = [
    p.is_frozen ? (de ? "Tiefkühlware – Versand per Tiefkühl-Express, lokale Lieferung oder Abholung." : "Frozen – ships by frozen express, local delivery or pickup.") : null,
    p.age_restricted ? (de ? "Ab 18 – wir prüfen das Alter bei Lieferung und Abholung." : "18+ – we check age on delivery and pickup.") : null,
    de ? "Versand in 2–3 Werktagen, ab 69 € kostenlos." : "Delivery in 2–3 working days, free from €69.",
    de ? "Kostenlose Abholung in Kaiserslautern." : "Free pickup in Kaiserslautern.",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">{ui("home", lang)}</Link>
        {parent && <><span className="px-1.5">/</span><Link href={`/c/${parent.slug}`} className="hover:text-ink">{catT(parent)}</Link></>}
        {cat && <><span className="px-1.5">/</span><Link href={`/c/${cat.slug}`} className="hover:text-ink">{catT(cat)}</Link></>}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="grid gap-3 sm:grid-cols-2">
          {images.length ? (
            images.slice(0, 4).map((src, i) => (
              <div key={src} className={`overflow-hidden rounded-xl bg-surface ${i === 0 ? "sm:col-span-2" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={i === 0 ? title : ""} className="aspect-square w-full object-cover mix-blend-multiply" />
              </div>
            ))
          ) : (
            <div className="grid aspect-square place-items-center rounded-xl bg-surface text-sm text-muted sm:col-span-2">{ui("noPhoto", lang)}</div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {p.brand && <span>{p.brand}</span>}
            {p.country &&
              [p.country, ...(p.also_countries ?? [])].map((c) => (
                <Link key={c} href={`/shop?country=${encodeURIComponent(c)}`} className="hover:text-ink">
                  <span aria-hidden>{countryFlag(c)}</span> {countryLabel(c, lang)}
                </Link>
              ))}
          </div>
          <h1 className="display mt-2 text-2xl font-semibold leading-tight sm:text-[1.75rem]" style={{ textWrap: "balance" }}>{title}</h1>
          {de && p.title_de && p.title_de !== p.title && <p className="mt-1 text-xs text-muted">{p.title}</p>}
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-xl font-semibold">{money(p.price)}</span>
            {sale && <span className="text-sm text-muted line-through">{money(p.compare_at_price)}</span>}
          </div>
          <p className="mt-1 text-xs text-muted">
            {[size, base].filter(Boolean).join(" · ")}{(size || base) && " · "}
            {de ? <>inkl. {Number(p.tax_rate)} % MwSt., zzgl. <Link href="/info/lieferung" className="underline">Versand</Link></> : <>incl. {Number(p.tax_rate)}% VAT, plus <Link href="/info/lieferung" className="underline">delivery</Link></>}
          </p>
          <div className="mt-7"><AddToCart product={p} disabled={p.stock <= 0} lang={lang} /></div>
          <p className={`mt-3 text-xs ${p.stock > 0 ? "text-forest" : "text-danger"}`}>
            {p.stock > 5 ? ui("inStock", lang) : p.stock > 0 ? (de ? `Nur noch ${p.stock} Stück` : `Only ${p.stock} left`) : ui("outOfStock", lang)}
          </p>
          <ul className="mt-7 space-y-2 border-t border-line pt-5 text-xs text-muted">
            {facts.map((f) => <li key={f} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest" aria-hidden />{f}</li>)}
          </ul>
          {desc && (
            <details open className="group mt-6 border-t border-line pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {ui("description", lang)}<span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <div className="prose-shop mt-3 text-sm text-muted [&_strong]:text-ink" dangerouslySetInnerHTML={{ __html: desc }} />
            </details>
          )}
          <p className="mt-6 text-[0.6875rem] text-muted">
            SKU {p.sku}. {de ? "Zutaten, Allergene und Nährwerte stehen auf der Packung; schreib uns auf WhatsApp für ein Foto des Etiketts." : "Ingredients, allergens and nutrition values are printed on the pack; message us on WhatsApp for a photo of the label."}
          </p>
        </div>
      </div>

      <div className="reveal mt-20">
        <ProductRecipes productId={p.id} lang={lang} />
      </div>

      {related.length > 0 && (
        <section className="reveal mt-20">
          <div className="mb-7 flex items-end justify-between gap-4">
            <h2 className="h-section">{ui("youMayLike", lang)}</h2>
            {cat && <Link href={`/c/${cat.slug}`} className="link-more">{ui("seeAll", lang)}</Link>}
          </div>
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }}>
            {related.map((r) => <ProductCard key={r.id} p={r} lang={lang} />)}
          </Rail>
        </section>
      )}
      {favourites.length > 0 && (
        <section className="reveal mt-20">
          <h2 className="h-section mb-7">{ui("favourites", lang)}</h2>
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }}>
            {favourites.filter((f) => f.id !== p.id).map((r) => <ProductCard key={r.id} p={r} lang={lang} />)}
          </Rail>
        </section>
      )}
    </div>
  );
}
