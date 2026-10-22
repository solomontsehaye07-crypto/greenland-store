import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import { getCategories, getProductsInCategories, getBestsellers } from "@/lib/catalog";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import { BuyBox } from "@/components/buy-box";
import { ReviewForm, Stars } from "@/components/reviews";
import { getCartPerks } from "@/lib/perks";
import { getReviews, myReview } from "@/lib/reviews";
import { currentCustomer } from "@/lib/customer";
import { getFrozenInfo, getPaymentConfig } from "@/lib/commerce";
import { img, openFactsCredit } from "@/lib/img";
import type { CardProduct } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { Rail } from "@/components/sections/rail";
import { ProductRecipes } from "@/components/recipe-suggestions-server";
import { countryFlag, countryLabel } from "@/lib/countries";
import type { Product } from "@/lib/types";
import { getLang, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type P = Product & { description_de?: string | null; also_countries?: string[] | null; title_de?: string | null };

async function load(slug: string) {
  const { data } = await supabasePublic()
    .from("products")
    .select("id, sku, slug, title, title_de, brand, description, description_de, category_id, price, compare_at_price, tax_rate, weight_g, size_qty, size_unit, image_url, images, country, also_countries, is_frozen, age_restricted, is_dropship, status, featured, stock, sale_ends_at, bullets_de, bullets_en, size_group, ingredients, qty_discount")
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
  const [related, favourites, perks, reviews, me, pay, sizes, frozenInfo] = await Promise.all([
    cat ? getProductsInCategories([cat.id], { limit: 13 }).then((r) => r.products.filter((x) => x.id !== p.id && x.stock > 0).slice(0, 10)) : Promise.resolve([]),
    getBestsellers(10),
    getCartPerks(),
    getReviews(p.id),
    currentCustomer(),
    getPaymentConfig(),
    p.size_group
      ? supabasePublic().from("products").select("id, slug, title, title_de, price, size_qty, size_unit, stock").eq("status", "active").eq("size_group", p.size_group).order("size_qty", { ascending: true, nullsFirst: false }).limit(8).then((r) => r.data ?? [])
      : Promise.resolve([]),
    getFrozenInfo(),
  ]);
  const mine = me ? await myReview(me.id, p.id) : null;
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const images = p.images?.length ? p.images : p.image_url ? [p.image_url] : [];
  const photoCredit = openFactsCredit(images[0]);
  const bullets = ((de ? p.bullets_de : p.bullets_en)?.length ? (de ? p.bullets_de : p.bullets_en) : de ? p.bullets_en : p.bullets_de) ?? [];
  const payLabels: Record<string, { de: string; en: string }> = {
    stripe: { de: "Kreditkarte", en: "Card" },
    viva: { de: "Karte", en: "Card" },
    paypal: { de: "PayPal", en: "PayPal" },
    bank: { de: "Überweisung", en: "Bank transfer" },
    cash: { de: "Bar / Karte bei Abholung", en: "Cash / card on pickup" },
  };
  const payments = [...new Set(pay.methods.map((m) => payLabels[m]?.[lang]).filter(Boolean))] as string[];
  const buyable: CardProduct = { ...p, title: p.title, qty_discount: p.qty_discount } as CardProduct;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    sku: p.sku,
    image: images,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: { "@type": "Offer", priceCurrency: "EUR", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
    aggregateRating: reviews.count ? { "@type": "AggregateRating", ratingValue: reviews.avg, reviewCount: reviews.count } : undefined,
  };
  const facts = [
    p.is_frozen
      ? frozenInfo.courier != null
        ? de
          ? `Tiefkühlware – Versand per DHL Express in der Styroporbox mit Trockeneis (pauschal ${money(frozenInfo.courier)}${frozenInfo.courierMin > 0 ? `, ab ${money(frozenInfo.courierMin)} Bestellwert` : ""}), lokale Lieferung oder Abholung.`
          : `Frozen – ships by DHL Express in an insulated box with dry ice (flat ${money(frozenInfo.courier)}${frozenInfo.courierMin > 0 ? `, minimum order ${money(frozenInfo.courierMin)}` : ""}), local delivery or pickup.`
        : de
          ? `Tiefkühlware – nur Abholung im Laden${frozenInfo.local?.radius ? ` oder Lieferung im Umkreis von ${frozenInfo.local.radius} km${frozenInfo.local.freeFrom != null ? ` (ab ${money(frozenInfo.local.freeFrom)} kostenlos)` : ""}` : ""}, kein Paketversand.`
          : `Frozen – pickup in store${frozenInfo.local?.radius ? ` or delivery within ${frozenInfo.local.radius} km${frozenInfo.local.freeFrom != null ? ` (free from ${money(frozenInfo.local.freeFrom)})` : ""}` : ""} only, no parcel shipping.`
      : null,
    p.age_restricted ? (de ? "Ab 18 – wir prüfen das Alter bei Lieferung und Abholung." : "18+ – we check age on delivery and pickup.") : null,
  ].filter(Boolean) as string[];
  const freeLine = perks.freeFrom ? (de ? ` · ab ${money(perks.freeFrom)} versandkostenfrei` : ` · free from ${money(perks.freeFrom)}`) : "";
  const Acc = ({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) => (
    <details open={open} className="group border-b border-line py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        {title}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted transition-transform group-open:rotate-180" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
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
                <img src={img(src, i === 0 ? 1000 : 600)} alt={i === 0 ? title : ""} loading={i === 0 ? "eager" : "lazy"} className="aspect-square w-full object-cover mix-blend-multiply" />
              </div>
            ))
          ) : (
            <div className="grid aspect-square place-items-center rounded-xl bg-surface text-sm text-muted sm:col-span-2">{ui("noPhoto", lang)}</div>
          )}
          {photoCredit && (
            <p className="text-[11px] text-muted sm:col-span-2">
              {de ? "Foto" : "Photo"}: <a href={photoCredit.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{photoCredit.name}</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">CC BY-SA</a>
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {p.brand && <span className="font-semibold uppercase tracking-wide text-ink/70">{p.brand}</span>}
            {p.country &&
              [p.country, ...(p.also_countries ?? [])].map((c) => (
                <Link key={c} href={`/shop?country=${encodeURIComponent(c)}`} className="hover:text-ink">
                  <span aria-hidden>{countryFlag(c)}</span> {countryLabel(c, lang)}
                </Link>
              ))}
          </div>
          <h1 className="display mt-2 text-2xl font-semibold leading-tight sm:text-[2rem]" style={{ textWrap: "balance" }}>{title}</h1>
          {de && p.title_de && p.title_de !== p.title && <p className="mt-1 text-xs text-muted">{p.title}</p>}
          {reviews.count > 0 && (
            <a href="#bewertungen" className="mt-2 inline-flex items-center gap-2 text-sm">
              <Stars value={reviews.avg} />
              <span className="font-semibold">{reviews.avg.toLocaleString(de ? "de-DE" : "en-GB")}</span>
              <span className="text-muted underline-offset-2 hover:underline">({reviews.count} {de ? (reviews.count === 1 ? "Bewertung" : "Bewertungen") : reviews.count === 1 ? "review" : "reviews"})</span>
            </a>
          )}

          {sizes.length > 1 && (
            <div className="mt-5">
              <p className="text-xs font-semibold">{de ? "Packungsgröße" : "Pack size"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const label = sizeLabel(s.size_qty, s.size_unit) ?? ((de && s.title_de) || s.title);
                  const current = s.id === p.id;
                  return (
                    <Link
                      key={s.id}
                      href={`/p/${s.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={`rounded-xl border px-3 py-2 text-sm ${current ? "border-forest bg-forest/5 font-semibold ring-1 ring-forest" : "border-line bg-white hover:border-ink/40"} ${s.stock > 0 ? "" : "opacity-50"}`}
                    >
                      {label}
                      <span className="ml-2 text-xs text-muted tabular-nums">{money(s.price)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {bullets.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-forest" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <BuyBox product={buyable} tiers={perks.tiers} lang={lang} compareAt={p.compare_at_price ? Number(p.compare_at_price) : null} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {[size, base].filter(Boolean).join(" · ")}{(size || base) && " · "}
            {de ? <>inkl. {Number(p.tax_rate ?? 7)} % MwSt., zzgl. <Link href="/info/lieferung" className="underline">Versand</Link></> : <>incl. {Number(p.tax_rate ?? 7)}% VAT, plus <Link href="/info/lieferung" className="underline">delivery</Link></>}
          </p>

          <ul className="mt-5 space-y-2.5 rounded-2xl bg-white p-4 text-sm">
            <li className="flex items-center gap-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${p.stock > 0 ? "bg-forest" : "bg-danger"}`} aria-hidden />
              <span className={p.stock > 0 ? "text-forest" : "text-danger"}>{p.stock > 5 ? ui("inStock", lang) : p.stock > 0 ? (de ? `Nur noch ${p.stock} Stück` : `Only ${p.stock} left`) : ui("outOfStock", lang)}</span>
            </li>
            <li className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
              <span>{de ? "Lieferung in 2–3 Werktagen" : "Delivery in 2–3 working days"}<span className="text-muted">{freeLine}</span></span>
            </li>
            <li className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden><path d="M4 10l1.5-5h13L20 10M4 10v10h16V10M4 10h16M9 20v-5h6v5" /></svg>
              <span>{de ? "Kostenlos abholen in Kaiserslautern" : "Free pickup in Kaiserslautern"}</span>
            </li>
            {facts.map((f) => (
              <li key={f} className="flex items-start gap-3 text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-terra" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {payments.length > 0 && (
            <div className="mt-4">
              <p className="sr-only">{de ? "Zahlungsarten" : "Payment methods"}</p>
              <ul className="flex flex-wrap gap-1.5">
                {payments.map((m) => (
                  <li key={m} className="rounded-md border border-line bg-white px-2 py-1 text-[0.6875rem] font-semibold text-ink/80">{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-line">
            {desc && (
              <Acc title={ui("description", lang)} open>
                <div className="prose-shop [&_strong]:text-ink" dangerouslySetInnerHTML={{ __html: desc }} />
              </Acc>
            )}
            <Acc title={de ? "Zutaten & Allergene" : "Ingredients & allergens"}>
              {p.ingredients ? (
                <p className="whitespace-pre-line">{p.ingredients}</p>
              ) : (
                <p>{de ? "Zutaten, Allergene und Nährwerte stehen auf der Packung. Schreib uns auf WhatsApp – wir schicken dir gern ein Foto des Etiketts." : "Ingredients, allergens and nutrition values are printed on the pack. Message us on WhatsApp and we send you a photo of the label."}</p>
              )}
            </Acc>
            <Acc title={de ? "Lieferung & Abholung" : "Delivery & pickup"}>
              <p>
                {de
                  ? `Wir versenden innerhalb von 1–2 Werktagen, die Zustellung dauert meist 2–3 Werktage${perks.freeFrom ? `, ab ${money(perks.freeFrom)} kostenlos` : ""}. Tiefkühlware reist im Isolierkarton mit Kühlakkus. In Kaiserslautern kannst du kostenlos abholen.`
                  : `We ship within 1–2 working days; delivery usually takes 2–3 working days${perks.freeFrom ? `, free from ${money(perks.freeFrom)}` : ""}. Frozen food travels in an insulated box with cooling packs. Pickup in Kaiserslautern is free.`}{" "}
                <Link href="/info/lieferung" className="underline">{de ? "Alle Details" : "All details"}</Link>
              </p>
            </Acc>
          </div>
          <p className="mt-4 text-[0.6875rem] text-muted">SKU {p.sku}</p>
        </div>
      </div>

      <section id="bewertungen" className="mt-20 scroll-mt-32">
        <h2 className="h-section">{de ? "Bewertungen" : "Reviews"}</h2>
        <div className="mt-7 grid gap-10 lg:grid-cols-[18rem_1fr]">
          <div>
            {reviews.count > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-semibold leading-none">{reviews.avg.toLocaleString(de ? "de-DE" : "en-GB")}</span>
                  <div className="pb-1">
                    <Stars value={reviews.avg} size={18} />
                    <p className="text-xs text-muted">{reviews.count} {de ? (reviews.count === 1 ? "Bewertung" : "Bewertungen") : reviews.count === 1 ? "review" : "reviews"}</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <li key={n} className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-3 tabular-nums">{n}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-saffron" style={{ width: `${(reviews.dist[n - 1] / reviews.count) * 100}%` }} /></span>
                      <span className="w-6 text-right tabular-nums">{reviews.dist[n - 1]}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted">{de ? "Noch keine Bewertungen. Hast du das Produkt schon probiert? Erzähl anderen davon." : "No reviews yet. Tried it already? Tell others about it."}</p>
            )}
            <div className="mt-6">
              <ReviewForm productId={p.id} slug={p.slug} signedIn={!!me} mine={mine} lang={lang} />
            </div>
          </div>
          {reviews.count > 0 && (
            <ul className="divide-y divide-line">
              {reviews.items.slice(0, 20).map((r) => (
                <li key={r.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={14} />
                    <span className="text-sm font-semibold" data-no-translate>{r.name}</span>
                    {r.verified && <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-forest">{de ? "Verifizierter Kauf" : "Verified purchase"}</span>}
                    <span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString(de ? "de-DE" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  {r.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" data-no-translate>{r.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="reveal mt-20">
        <ProductRecipes productId={p.id} lang={lang} />
      </div>

      {related.length > 0 && (
        <section className="reveal mt-20">
          <div className="mb-7 flex items-end justify-between gap-4">
            <h2 className="h-section">{ui("youMayLike", lang)}</h2>
            {cat && <Link href={`/c/${cat.slug}`} className="link-more">{ui("seeAll", lang)}</Link>}
          </div>
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }} motion="step">
            {related.map((r) => <ProductCard key={r.id} p={r} lang={lang} />)}
          </Rail>
        </section>
      )}
      {favourites.length > 0 && (
        <section className="reveal mt-20">
          <h2 className="h-section mb-7">{ui("favourites", lang)}</h2>
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }} motion="glide">
            {favourites.filter((f) => f.id !== p.id).map((r) => <ProductCard key={r.id} p={r} lang={lang} />)}
          </Rail>
        </section>
      )}
    </div>
  );
}
