import Link from "next/link";
import { Fragment } from "react";
import type { HomeSection } from "@/lib/content";
import { getCategories, getCountryCounts, getOffers, getRailProducts, getRecommended } from "@/lib/catalog";
import { money } from "@/lib/format";
import { AddToCart } from "../add-to-cart";
import { productTitle } from "../product-card";
import { Scene } from "./scene";
import { supabasePublic } from "@/lib/supabase";
import { countryFlag, countryLabel } from "@/lib/countries";
import { tx, ui, type L10n, type Lang } from "@/lib/i18n";
import { Icon } from "../icons";
import { img, imgSet } from "@/lib/img";
import { Markdown } from "../markdown";
import { ProductCard, ProductGrid } from "../product-card";
import { AutoScrollList, Rail, type RailMotion } from "./rail";
import { NewsletterForm } from "./newsletter-form";
import { getGoogleReviews } from "@/lib/google-reviews";
import { nationwideFreeFrom } from "@/lib/perks";
import { Stars } from "../reviews";

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const L = (v: unknown, lang: Lang) => tx(v as L10n, lang);
const WRAP = "mx-auto max-w-7xl px-4";

/**
 * Every home section sits on its own full-width colour band, so the page reads as a row of
 * clearly separate stalls instead of one long list. Light bands can hold product cards;
 * dark bands are for editorial sections (hero, countries, story, newsletter, banners).
 */
const LIGHT: Record<string, string> = {
  none: "band-paper",
  paper: "band-paper",
  sand: "band-sand",
  saffron: "band-saffron",
  forest: "band-mint",
  indigo: "band-sky",
  terra: "band-clay",
};
const DARK: Record<string, string> = {
  forest: "band-forest",
  indigo: "band-indigo",
  terra: "band-terra",
  ink: "band-ink",
  saffron: "band-saffron",
  sand: "band-sand",
  none: "band-paper",
};
const band = (color: string | undefined, fallback: string, dark = false) => (dark ? DARK : LIGHT)[color || fallback] ?? (dark ? DARK : LIGHT)[fallback];
const isDark = (cls: string) => ["band-forest", "band-indigo", "band-terra", "band-ink"].includes(cls);

function SmartLink({ href, className, children, ...rest }: { href?: string; className?: string; children: React.ReactNode; "aria-label"?: string }) {
  const h = href || "/";
  if (/^https?:\/\//.test(h)) return <a href={h} className={className} rel="noopener" {...rest}>{children}</a>;
  return <Link href={h} className={className} {...rest}>{children}</Link>;
}

function Head({ title, text, lang, link, center }: { title?: unknown; text?: unknown; lang: Lang; link?: { href: string; label: string }; center?: boolean }) {
  const t = L(title, lang);
  const p = L(text, lang);
  if (!t && !p && !link) return null;
  return (
    <div className={`mb-8 flex flex-wrap items-end gap-x-6 gap-y-3 sm:mb-10 ${center ? "flex-col items-center text-center" : "justify-between"}`}>
      <div className="max-w-2xl">
        {t && <h2 className="h-section" style={{ textWrap: "balance" }}>{t}</h2>}
        {p && <p className="mt-2 text-[0.9375rem] text-muted">{p}</p>}
      </div>
      {link && (
        <Link href={link.href} className="pill-link">
          {link.label}
          <Icon name="arrowR" size={14} />
        </Link>
      )}
    </div>
  );
}

// ---------- hero: headline on deep green, three columns of products drifting past ----------
/**
 * Headline as fixed lines, so it never jumps between one and two lines while the web font loads.
 * A line break typed in the title wins; otherwise the words are split into two balanced lines.
 * Each word rises in on its own (see .hero-in in globals.css).
 */
const words = (t: string) => {
  const typed = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  let lines = typed;
  if (typed.length === 1) {
    const w = typed[0].split(/\s+/);
    if (w.length > 1) {
      const total = typed[0].length;
      let best = 1;
      let bestDiff = Infinity;
      for (let i = 1; i < w.length; i++) {
        const diff = Math.abs(w.slice(0, i).join(" ").length * 2 - total);
        if (diff < bestDiff) [best, bestDiff] = [i, diff];
      }
      lines = [w.slice(0, best).join(" "), w.slice(best).join(" ")];
    }
  }
  let n = 0;
  return lines.map((line, li) => (
    <span key={li} className="hero-line">
      {line.split(/\s+/).map((word, wi) => (
        <span key={wi} className="hero-word" style={{ animationDelay: `${0.12 + n++ * 0.06}s` }}>
          {word}
          {wi < line.split(/\s+/).length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </span>
  ));
};

/** Background photos that fade into each other (hero setting "slides"). Builds its own keyframes for any count. */
function HeroSlides({ slides }: { slides: { image: string; position?: string }[] }) {
  const n = slides.length;
  const each = 7; // seconds per photo
  const fade = (1.6 / (n * each)) * 100;
  const show = 100 / n;
  const css = `@keyframes hero-slide-${n}{0%{opacity:0;transform:scale(1.1)}${fade.toFixed(2)}%{opacity:1}${show.toFixed(2)}%{opacity:1}${(show + fade).toFixed(2)}%{opacity:0;transform:scale(1)}100%{opacity:0;transform:scale(1)}}`;
  return (
    <div className="hero-slides" aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {slides.map((sl, i) => (
        <div
          key={sl.image + i}
          className="hero-slide"
          style={{
            backgroundImage: `url("${img(sl.image, 1800).replace(/"/g, "%22")}")`,
            backgroundPosition: sl.position || "center",
            animation: `hero-slide-${n} ${n * each}s linear infinite`,
            animationDelay: `${i * each}s`,
            // the first photo is there from the start, before any animation runs
            opacity: i === 0 ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}

async function Hero({ d, lang }: { d: D; lang: Lang }) {
  let strip: { image: string; href?: string; label?: string }[] = (d.images ?? []).filter((x: D) => x.image);
  const showProducts = d.showProducts !== false;
  const [rec, countries, { count }, { data: ship }] = await Promise.all([
    showProducts && d.autoFill !== false && strip.length < 18 ? getRecommended(24 - strip.length) : Promise.resolve([]),
    getCountryCounts(),
    supabasePublic().from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabasePublic().from("shipping_methods").select("free_from, type, countries").eq("active", true).not("free_from", "is", null),
  ]);
  strip = [...strip, ...rec.filter((p) => p.image_url).map((p) => ({ image: p.image_url as string, href: `/p/${p.slug}`, label: lang === "de" ? p.title_de || p.title : p.title }))];
  const cols = [0, 1, 2].map((c) => strip.filter((_, i) => i % 3 === c));
  const products = count ?? 0;
  const freeFrom = nationwideFreeFrom(ship ?? []) ?? NaN;
  const stats = [
    { n: products > 50 ? `${Math.floor(products / 50) * 50}+` : String(products), l: lang === "de" ? "Produkte" : "products" },
    { n: String(countries.length), l: lang === "de" ? "Herkunftsländer" : "countries of origin" },
    ...(Number.isFinite(freeFrom) ? [{ n: `${lang === "de" ? "ab" : "from"} ${freeFrom.toLocaleString("de-DE")} €`, l: lang === "de" ? "versandkostenfrei" : "free delivery" }] : []),
  ];

  const tile = (im: { image: string; href?: string; label?: string }, key: string, hidden: boolean, cls: string) => (
    <li key={key} className={cls} aria-hidden={hidden || undefined}>
      <SmartLink href={im.href} className="block h-full p-3" aria-label={hidden ? undefined : im.label}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={im.image} alt="" loading="eager" className="h-full w-full object-contain" />
      </SmartLink>
    </li>
  );
  const moving = showProducts && strip.length >= 6 && !d.photoHero;
  const slides: { image: string; position?: string }[] = (d.slides ?? []).filter((x: D) => typeof x?.image === "string" && /^https?:\/\//.test(x.image)).slice(0, 5);

  if (d.photoHero !== false && !moving) {
    // full-bleed photo hero: headline bottom-left over the picture, like a food magazine cover
    return (
      <section className={`hero hero-photo-layout ${slides.length > 1 ? "has-slides" : ""}`}>
        <div className="hero-photo" aria-hidden />
        {slides.length > 1 && <HeroSlides slides={slides} />}
        <div className={`${WRAP} relative flex min-h-[34rem] flex-col justify-end pb-12 pt-28 sm:min-h-[38rem] lg:min-h-[44rem] lg:pb-16`}>
          <div className="hero-in max-w-2xl">
            <h1 className="hero-title hero-title-xl" style={{ textWrap: "balance" }}>{words(L(d.title, lang))}</h1>
            {L(d.text, lang) && <p className="mt-5 max-w-lg text-base leading-relaxed opacity-90 sm:text-lg">{L(d.text, lang)}</p>}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {L(d.cta1Label, lang) && <SmartLink href={d.cta1Href} className="btn btn-hero h-12 px-7 text-[0.9375rem]">{L(d.cta1Label, lang)}<Icon name="arrowR" size={16} /></SmartLink>}
              {L(d.cta2Label, lang) && <SmartLink href={d.cta2Href} className="btn btn-hero-glass h-12 px-7 text-[0.9375rem]">{L(d.cta2Label, lang)}</SmartLink>}
            </div>
            <dl className="hero-stats-panel mt-9">
              {stats.map((st) => (
                <div key={st.l}>
                  <dt className="mt-1.5 text-[0.75rem] leading-snug text-white/85 sm:text-sm">{st.l}</dt>
                  <dd className="display text-[1.5rem] font-semibold leading-none sm:text-[2rem]">{st.n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hero">
      <div className="hero-photo" aria-hidden />
      <div className="hero-weave" aria-hidden />
      <div className={`${WRAP} relative grid items-stretch gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 ${moving ? "" : "lg:grid-cols-1"}`}>
        <div className="hero-in py-14 sm:py-16 lg:py-24">
          <h1 className="hero-title" style={{ textWrap: "balance" }}>{words(L(d.title, lang))}</h1>
          {L(d.text, lang) && <p className="mt-6 max-w-lg text-base leading-relaxed opacity-80">{L(d.text, lang)}</p>}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {L(d.cta1Label, lang) && <SmartLink href={d.cta1Href} className="btn btn-hero h-12 px-7 text-[0.9375rem]">{L(d.cta1Label, lang)}<Icon name="arrowR" size={16} /></SmartLink>}
            {L(d.cta2Label, lang) && <SmartLink href={d.cta2Href} className="btn btn-hero-outline h-12 px-7 text-[0.9375rem]">{L(d.cta2Label, lang)}</SmartLink>}
          </div>
          <dl className="hero-stats mt-12 grid max-w-lg grid-cols-3 gap-4 pt-6">
            {stats.map((st) => (
              <div key={st.l}>
                <dt className="sr-only">{st.l}</dt>
                <dd className="display text-2xl font-semibold sm:text-3xl" style={{ color: "var(--hero-accent)" }}>{st.n}</dd>
                <dd className="mt-1 text-xs leading-snug opacity-75">{st.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {moving && (
          <div className="hero-columns" aria-label={lang === "de" ? "Produkte aus dem Laden" : "Products from the shop"}>
            {cols.map((col, c) => (
              <div key={c} className={c === 1 ? "hero-col-rev" : ""} style={{ ["--col-s" as string]: `${38 + c * 9}s` }}>
                <ul className="hero-col-track">
                  {col.map((im, i) => tile(im, `a${i}`, false, "hero-tile"))}
                  {col.map((im, i) => tile(im, `b${i}`, true, "hero-tile"))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      {moving && (
        <div className="hero-strip marquee" style={{ ["--marquee-s" as string]: `${Math.max(40, strip.length * 4)}s` }} aria-hidden>
          <ul className="marquee-track py-4">
            {strip.map((im, i) => tile(im, `m${i}`, true, "hero-strip-tile"))}
            {strip.map((im, i) => tile(im, `n${i}`, true, "hero-strip-tile"))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------- thin moving text line ----------
function Marquee({ d, lang }: { d: D; lang: Lang }) {
  const items: string[] = (d.items ?? []).map((x: D) => L(x.text, lang)).filter(Boolean);
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((t, i) => (
        <li key={i} className="flex items-center whitespace-nowrap px-8 text-sm font-medium">
          {t}<span className="ml-16 h-1.5 w-1.5 rounded-full bg-current opacity-40" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <section className={`marquee overflow-hidden py-3 ${band(d.color, "saffron", true)}`} style={{ ["--marquee-s" as string]: `${Number(d.seconds) || 45}s` }}>
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </section>
  );
}

// ---------- category tiles ----------
function Tiles({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  const round = d.shape === "circle";
  return (
    <section className={`${band(d.color, "none")} py-16 sm:py-20`}>
      <div className={WRAP}>
        <Head title={d.title} text={d.text} lang={lang} link={{ href: "/shop", label: lang === "de" ? "Alle Produkte" : "All products" }} />
        <ul className="tiles-grid">
          {items.map((t, i) => (
            <li key={i}>
              <SmartLink href={t.href} className="tile reveal-item group">
                <div className={`tile-img ${round ? "rounded-full" : ""}`}>
                  {t.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(t.image, 320)} srcSet={imgSet(t.image, 320)} sizes="(min-width: 1024px) 200px, 33vw" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.06]" />
                  )}
                </div>
                <span className="tile-label">{L(t.label, lang)}</span>
              </SmartLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- product sections ----------
const DEFAULT_LINK: Record<string, string> = { bestsellers: "/shop", recommended: "/shop", newest: "/shop?sort=new", sale: "/shop?sale=1" };

async function Products({ d, lang }: { d: D; lang: Lang }) {
  const products = await getRailProducts(d.source, d.category || undefined, Number(d.limit) || 10, d.country || undefined, d.productIds);
  if (!products.length) return null;
  let href: string | undefined = d.linkHref || DEFAULT_LINK[d.source];
  if (!d.linkHref && d.source === "category" && d.category) href = `/c/${d.category}`;
  if (!d.linkHref && d.source === "country" && d.country) href = `/shop?country=${encodeURIComponent(d.country)}`;
  const link = href ? { href, label: L(d.linkLabel, lang) || ui("seeAll", lang) } : undefined;
  const badge = d.source === "bestsellers" ? ui("bestseller", lang) : undefined;
  return (
    <section className={`${band(d.color, "none")} py-16 sm:py-20`}>
      <div className={WRAP}>
        <Head title={d.title} text={d.text} lang={lang} link={link} />
        {d.layout === "grid" ? (
          <ProductGrid products={products} lang={lang} />
        ) : (
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }} motion={(["off", "step", "back", "glide"].includes(d.motion) ? d.motion : "step") as RailMotion}>
            {products.map((p, i) => <ProductCard key={p.id} p={p} lang={lang} badge={badge && i < 3 ? badge : undefined} />)}
          </Rail>
        )}
      </div>
    </section>
  );
}

// ---------- offers: loud, colourful, before/after prices ----------
const OFFER_TONES: Record<string, string> = { terra: "offers-terra", saffron: "offers-saffron", forest: "offers-forest", indigo: "offers-indigo", ink: "offers-ink" };

async function Offers({ d, lang }: { d: D; lang: Lang }) {
  const items = await getOffers(Math.min(Number(d.limit) || 12, 24), d.source === "picked" ? d.productIds : undefined);
  if (!items.length) return null;
  const pct = (p: { price: number; compare_at_price: number | null }) => Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100);
  const best = Math.max(...items.map(pct));
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "short" });
  return (
    <section className={`offers ${OFFER_TONES[d.color] ?? "offers-terra"} py-16 sm:py-20`}>
      <div className={WRAP}>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-5">
            <span className="offers-sticker" aria-hidden>
              <span className="text-[0.625rem] font-semibold">{lang === "de" ? "bis zu" : "up to"}</span>
              <span className="display text-2xl font-bold leading-none">−{best}%</span>
            </span>
            <div>
              <h2 className="h-section" style={{ textWrap: "balance" }}>{L(d.title, lang) || (lang === "de" ? "Angebote" : "Offers")}</h2>
              {L(d.text, lang) && <p className="mt-1.5 text-[0.9375rem] opacity-85">{L(d.text, lang)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {L(d.badge, lang) && <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">{L(d.badge, lang)}</span>}
            <Link href="/shop?sale=1" className="pill-link">{lang === "de" ? "Alle Angebote" : "All offers"}<Icon name="arrowR" size={14} /></Link>
          </div>
        </div>
        <AutoScrollList className="offers-grid" motion="step">
          {items.map((p) => (
            <li key={p.id} className="offer-card group">
              <Link href={`/p/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url ?? ""} alt={productTitle(p, lang)} loading="lazy" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
                <span className="offer-badge">−{pct(p)}%</span>
              </Link>
              <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                <Link href={`/p/${p.slug}`} className="line-clamp-2 text-[0.8125rem] leading-snug text-ink hover:underline">{productTitle(p, lang)}</Link>
                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                  <div className="leading-tight">
                    <span className="block text-xs text-muted line-through decoration-terra/70">{lang === "de" ? "statt" : "was"} {money(Number(p.compare_at_price))}</span>
                    <span className="display text-xl font-bold text-terra">{money(p.price)}</span>
                    {p.sale_ends_at && <span className="block text-[0.6875rem] text-muted">{lang === "de" ? "bis" : "until"} {fmtDate(p.sale_ends_at)}</span>}
                  </div>
                  <AddToCart product={p} compact lang={lang} />
                </div>
              </div>
            </li>
          ))}
        </AutoScrollList>
      </div>
    </section>
  );
}

// ---------- feature banners: big coloured panels ----------
function Banners({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  if (!items.length) return null;
  return (
    <section className="band-paper py-14 sm:py-20">
      <div className={`${WRAP} grid gap-6`}>
        {items.map((b, i) => {
          const photoRight = i % 2 === 1;
          const dark = ["terra", "forest", "indigo", "ink"].includes(b.color);
          const tone = dark ? band(b.color, "terra", true) : "promo-sand";
          return (
            <SmartLink key={i} href={b.href} className={`promo reveal-item group ${tone} ${photoRight ? "promo-right" : ""}`}>
              <div className="promo-img">
                {b.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img(b.image, 900)} srcSet={imgSet(b.image, 900)} sizes="(min-width: 768px) 50vw, 100vw" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                )}
              </div>
              <div className="promo-body">
                {L(b.kicker, lang) && <p className="text-base text-muted">{L(b.kicker, lang)}</p>}
                <h3 className="display mt-2 text-2xl font-semibold leading-tight sm:text-3xl lg:text-[2.25rem]" style={{ textWrap: "balance" }}>{L(b.title, lang)}</h3>
                {L(b.text, lang) && <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-muted">{L(b.text, lang)}</p>}
                {L(b.ctaLabel, lang) && <span className="promo-cta">{L(b.ctaLabel, lang)}<Icon name="arrowR" size={14} /></span>}
              </div>
            </SmartLink>
          );
        })}
      </div>
    </section>
  );
}

// ---------- promises: a trust bar straight under the hero ----------
function Usp({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  const compact = d.style !== "cards";
  if (compact)
    return (
      <section className="trust-band">
        {L(d.title, lang) && <h2 className="sr-only">{L(d.title, lang)}</h2>}
        <ul className={`${WRAP} grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-center lg:grid-cols-4`}>
          {items.map((u, i) => (
            <li key={i} className="flex items-center justify-center gap-2 text-[0.8125rem] font-semibold leading-snug">
              <Icon name={u.icon} size={16} />
              <span>{L(u.title, lang)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <section className={`${band(d.color, "none")} border-b border-line`}>
      {L(d.title, lang) && <h2 className="sr-only">{L(d.title, lang)}</h2>}
      <ul className={`${WRAP} grid grid-cols-2 gap-x-6 gap-y-5 py-7 lg:grid-cols-4`}>
        {items.map((u, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest/10 text-forest"><Icon name={u.icon} size={19} /></span>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold leading-snug">{L(u.title, lang)}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{L(u.text, lang)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- story ----------
function Story({ d, lang }: { d: D; lang: Lang }) {
  const right = d.imageSide === "right";
  const tone = band(d.color, "forest", true);
  const dark = isDark(tone);
  return (
    <section className={`${tone} py-16 sm:py-24`}>
      <div className={`${WRAP} grid items-center gap-10 md:grid-cols-2 md:gap-16`}>
        {d.image && (
          <div className={`aspect-square overflow-hidden rounded-3xl bg-white ${right ? "md:order-2" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image} alt="" loading="lazy" className="h-full w-full object-contain p-8" />
          </div>
        )}
        <div className="max-w-lg">
          <h2 className="h-section text-[2rem] sm:text-[2.5rem]" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
          <Markdown text={L(d.text, lang)} className={`mt-5 text-base ${dark ? "text-white/80" : "text-muted"}`} />
          {L(d.ctaLabel, lang) && <SmartLink href={d.ctaHref} className={`btn mt-8 h-11 px-6 ${dark ? "btn-saffron" : "btn-primary"}`}>{L(d.ctaLabel, lang)}</SmartLink>}
        </div>
      </div>
    </section>
  );
}

function Faq({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  return (
    <section className={`${band(d.color, "none")} py-16 sm:py-20`}>
      <div className={`${WRAP} grid items-start gap-8 md:grid-cols-[1fr_2fr] md:gap-16`}>
        <h2 className="h-section" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
        <div className="space-y-3">
          {items.map((f, i) => (
            <details key={i} className="faq group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.9375rem] font-medium">
                {L(f.q, lang)}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand text-base leading-none transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 whitespace-pre-line pr-10 text-sm leading-relaxed text-muted">{L(f.a, lang)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

async function GoogleReviewsSection({ d, lang }: { d: D; lang: Lang }) {
  const g = await getGoogleReviews();
  if (!g.placeId || !g.rating) return null;
  const de = lang === "de";
  const items = g.reviews.filter((r) => r.rating >= (g.minRating ?? 4) && r.text).slice(0, 6);
  const write = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(g.placeId)}`;
  const rating = g.rating.toLocaleString(de ? "de-DE" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <section className={`${band(d.color, "sand")} py-16 sm:py-20`}>
      <div className={`${WRAP} grid items-start gap-10 lg:grid-cols-[18rem_1fr] lg:gap-14`}>
        <div>
          <h2 className="h-section" style={{ textWrap: "balance" }}>{L(d.title, lang) || (de ? "Das sagen unsere Kund:innen" : "What our customers say")}</h2>
          <div className="mt-6 flex items-center gap-4">
            <span className="text-6xl font-semibold leading-none tabular-nums">{rating}</span>
            <div>
              <Stars value={g.rating} size={20} />
              <p className="mt-1 text-sm text-muted">{de ? `${g.count} Bewertungen auf Google` : `${g.count} reviews on Google`}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {g.url && <a href={g.url} target="_blank" rel="noopener" className="btn btn-ghost text-sm">{de ? "Alle ansehen" : "See all"}</a>}
            <a href={write} target="_blank" rel="noopener" className="btn btn-primary text-sm">{de ? "Bewertung schreiben" : "Write a review"}</a>
          </div>
        </div>
        <div>
        {items.length > 0 && (
          <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
            {items.map((r, i) => (
              <li key={i} className="flex w-[17rem] shrink-0 snap-start flex-col rounded-2xl bg-white p-5 lg:w-auto">
                <Stars value={r.rating} size={15} />
                <p className="mt-3 line-clamp-6 flex-1 text-sm leading-relaxed" data-no-translate>{r.text}</p>
                <p className="mt-4 text-xs">
                  {r.authorUrl ? <a href={r.authorUrl} target="_blank" rel="noopener nofollow" className="font-semibold hover:underline" data-no-translate>{r.author}</a> : <span className="font-semibold" data-no-translate>{r.author}</span>}
                  {r.when && <span className="text-muted"> · {r.when}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[0.6875rem] text-muted">{de ? "Bewertungen von Google" : "Reviews from Google"}</p>
        </div>
      </div>
    </section>
  );
}

function Newsletter({ d, lang }: { d: D; lang: Lang }) {
  const tone = band(d.color === "sand" ? "ink" : d.color, "ink", true);
  return (
    <section className={`${tone} py-16 sm:py-20`}>
      <div className={`${WRAP} grid items-center gap-8 md:grid-cols-2 md:gap-16`}>
        <div>
          <h2 className="h-section text-[2rem] sm:text-[2.5rem]" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
          {L(d.text, lang) && <p className="mt-3 text-base opacity-75">{L(d.text, lang)}</p>}
        </div>
        <div className="newsletter-box">
          <NewsletterForm lang={lang} button={L(d.buttonLabel, lang) || ui("subscribe", lang)} placeholder={ui("emailAddress", lang)} thanks={ui("thanksSubscribed", lang)} />
          {L(d.note, lang) && <p className="mt-3 text-xs opacity-60">{L(d.note, lang)}</p>}
        </div>
      </div>
    </section>
  );
}

function TextBlock({ d, lang }: { d: D; lang: Lang }) {
  return (
    <section className={`${band(d.color, "none")} py-14`}>
      <div className="mx-auto max-w-2xl px-4">
        {L(d.title, lang) && <h2 className="h-section mb-4">{L(d.title, lang)}</h2>}
        <Markdown text={L(d.body, lang)} />
      </div>
    </section>
  );
}

// ---------- shop by country: a spotlight for shared cuisines plus a flag wall ----------
const PAIRS: { countries: [string, string]; title: L10n; text: L10n }[] = [
  {
    countries: ["Ethiopia", "Eritrea"],
    title: { de: "Habesha-Küche aus Äthiopien & Eritrea", en: "Habesha kitchen from Ethiopia & Eritrea" },
    text: { de: "Teff und Injera, Berbere und Shiro, Jebena und Kaffee – dieselben Zutaten, zwei Länder.", en: "Teff and injera, berbere and shiro, jebena and coffee – the same pantry, two countries." },
  },
];

/** Countries of origin drifting slowly left to right under the hero; each one opens that country's products. */
async function FlagStrip({ lang }: { lang: Lang }) {
  const list = (await getCountryCounts()).slice(0, 30);
  if (list.length < 4) return null;
  const item = (c: { country: string }, hidden: boolean) => (
    <li key={`${c.country}-${hidden ? "b" : "a"}`} aria-hidden={hidden || undefined}>
      <Link href={`/shop?country=${encodeURIComponent(c.country)}`} tabIndex={hidden ? -1 : undefined} className="flag-chip">
        <span className="flag-chip-flag" aria-hidden>{countryFlag(c.country)}</span>
        {countryLabel(c.country, lang)}
      </Link>
    </li>
  );
  return (
    <nav className="flag-strip marquee" aria-label={lang === "de" ? "Produkte nach Herkunftsland" : "Products by country of origin"} style={{ ["--marquee-s" as string]: `${Math.max(40, list.length * 3.2)}s` }}>
      <ul className="marquee-track marquee-rev">
        {list.map((c) => item(c, false))}
        {list.map((c) => item(c, true))}
      </ul>
    </nav>
  );
}

async function Countries({ d, lang }: { d: D; lang: Lang }) {
  const list = await getCountryCounts();
  if (!list.length) return null;
  const counts = new Map(list.map((c) => [c.country, c.count]));
  const pair = PAIRS.find((p) => p.countries.every((c) => counts.has(c)));
  const rest = list.filter((c) => !pair?.countries.includes(c.country)).slice(0, 23);
  return (
    <section className={`${band(d.color, "indigo", true)} py-16 sm:py-24`}>
      <div className={WRAP}>
        <Head title={d.title} text={d.text} lang={lang} link={{ href: "/laender", label: ui("seeAll", lang) }} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {pair && (
            <div className="spotlight">
              <div className="flex gap-3 text-5xl leading-none" aria-hidden>
                {pair.countries.map((c) => <span key={c}>{countryFlag(c)}</span>)}
              </div>
              <h3 className="display mt-6 text-2xl font-semibold leading-tight sm:text-[1.75rem]" style={{ textWrap: "balance" }}>{tx(pair.title, lang)}</h3>
              <p className="mt-3 text-sm leading-relaxed opacity-80">{tx(pair.text, lang)}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-8">
                {pair.countries.map((c) => (
                  <Link key={c} href={`/shop?country=${encodeURIComponent(c)}`} className="btn btn-light">
                    {countryLabel(c, lang)}<span className="text-xs opacity-60">{counts.get(c)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map((c, i) => (
              <li key={c.country} className={i >= 11 ? "hidden sm:block" : undefined}>
                <Link href={`/shop?country=${encodeURIComponent(c.country)}`} className="country-chip reveal-item">
                  <span className="text-2xl leading-none" aria-hidden>{countryFlag(c.country)}</span>
                  <span className="min-w-0 flex-1 truncate">{countryLabel(c.country, lang)}</span>
                  <span className="text-xs opacity-60">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------- recipe ideas: one big, the rest small ----------
async function Recipes({ d, lang }: { d: D; lang: Lang }) {
  const { data } = await supabasePublic()
    .from("recipes")
    .select("slug, title, intro, image_url, country, recipe_items(count)")
    .eq("published", true)
    .order("sort")
    .limit(Math.min(Number(d.limit) || 4, 8));
  const rows = (data ?? []) as { slug: string; title: L10n; intro: L10n; image_url: string | null; country: string | null; recipe_items: { count: number }[] }[];
  if (!rows.length) return null;
  const meta = (r: (typeof rows)[number]) =>
    [r.country ? countryLabel(r.country, lang, true) : null, `${r.recipe_items?.[0]?.count ?? 0} ${lang === "de" ? "Zutaten im Shop" : "ingredients in store"}`].filter(Boolean).join("  ·  ");
  const [first, ...more] = rows;
  return (
    <section className={`${band(d.color, "saffron")} py-16 sm:py-20`}>
      <div className={WRAP}>
        <Head title={d.title} text={d.text} lang={lang} link={{ href: "/rezepte", label: ui("seeAll", lang) }} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Link href={`/rezepte/${first.slug}`} className="recipe-card group lg:row-span-3">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-white">
              {first.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={first.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04]" />
              )}
            </div>
            <div className="p-2 pt-5">
              <p className="text-xs text-muted">{meta(first)}</p>
              <h3 className="display mt-1.5 text-2xl font-semibold group-hover:underline">{tx(first.title, lang)}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{tx(first.intro, lang)}</p>
            </div>
          </Link>
          {more.map((r) => (
            <Link key={r.slug} href={`/rezepte/${r.slug}`} className="recipe-card group flex-row items-center gap-5">
              <div className="aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-white sm:w-36">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                )}
              </div>
              <div className="min-w-0 py-2 pr-2">
                <p className="text-xs text-muted">{meta(r)}</p>
                <h3 className="mt-1 text-base font-semibold group-hover:underline">{tx(r.title, lang)}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{tx(r.intro, lang)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function Sections({ sections, lang }: { sections: HomeSection[]; lang: Lang }) {
  await getCategories(); // warm the category cache once for all product sections
  return (
    <>
      {sections.map((s) => {
        const d = s.data as D;
        switch (s.type) {
          case "hero":
            return (
              <Fragment key={s.id}>
                <Hero d={d} lang={lang} />
                {d.flagStrip !== false && <FlagStrip lang={lang} />}
              </Fragment>
            );
          case "marquee": return <Marquee key={s.id} d={d} lang={lang} />;
          case "tiles": return <Tiles key={s.id} d={d} lang={lang} />;
          case "products": return <Products key={s.id} d={d} lang={lang} />;
          case "offers": return <Offers key={s.id} d={d} lang={lang} />;
          case "scene": return <Scene key={s.id} d={d} lang={lang} />;
          case "banners": return <Banners key={s.id} d={d} lang={lang} />;
          case "usp": return <Usp key={s.id} d={d} lang={lang} />;
          case "story": return <Story key={s.id} d={d} lang={lang} />;
          case "faq": return <Faq key={s.id} d={d} lang={lang} />;
          case "newsletter": return <Newsletter key={s.id} d={d} lang={lang} />;
          case "text": return <TextBlock key={s.id} d={d} lang={lang} />;
          case "countries": return <Countries key={s.id} d={d} lang={lang} />;
          case "recipes": return <Recipes key={s.id} d={d} lang={lang} />;
          case "reviews": return <GoogleReviewsSection key={s.id} d={d} lang={lang} />;
          default: return null;
        }
      })}
    </>
  );
}
