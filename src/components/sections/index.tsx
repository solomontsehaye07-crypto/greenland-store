import Link from "next/link";
import type { HomeSection } from "@/lib/content";
import { getCategories, getCountryCounts, getRailProducts, getRecommended } from "@/lib/catalog";
import { supabasePublic } from "@/lib/supabase";
import { countryFlag, countryLabel } from "@/lib/countries";
import { tx, ui, type L10n, type Lang } from "@/lib/i18n";
import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { ProductCard, ProductGrid } from "../product-card";
import { Rail } from "./rail";
import { NewsletterForm } from "./newsletter-form";

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
async function Hero({ d, lang }: { d: D; lang: Lang }) {
  let strip: { image: string; href?: string; label?: string }[] = (d.images ?? []).filter((x: D) => x.image);
  const [rec, countries, { count }] = await Promise.all([
    d.autoFill !== false && strip.length < 18 ? getRecommended(24 - strip.length) : Promise.resolve([]),
    getCountryCounts(),
    supabasePublic().from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  strip = [...strip, ...rec.filter((p) => p.image_url).map((p) => ({ image: p.image_url as string, href: `/p/${p.slug}`, label: lang === "de" ? p.title_de || p.title : p.title }))];
  const cols = [0, 1, 2].map((c) => strip.filter((_, i) => i % 3 === c));
  const products = count ?? 0;
  const stats = [
    { n: products > 50 ? `${Math.floor(products / 50) * 50}+` : String(products), l: lang === "de" ? "Produkte" : "products" },
    { n: String(countries.length), l: lang === "de" ? "Herkunftsländer" : "countries of origin" },
    { n: "69 €", l: lang === "de" ? "ab hier versandkostenfrei" : "free delivery from here" },
  ];

  const tile = (im: { image: string; href?: string; label?: string }, key: string, hidden: boolean) => (
    <li key={key} className="mb-4 aspect-square overflow-hidden rounded-2xl bg-white" aria-hidden={hidden || undefined}>
      <SmartLink href={im.href} className="block h-full p-3" aria-label={hidden ? undefined : im.label}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={im.image} alt="" loading="eager" className="h-full w-full object-contain" />
      </SmartLink>
    </li>
  );

  return (
    <section className="band-forest relative overflow-hidden">
      <div className="hero-weave" aria-hidden />
      <div className={`${WRAP} relative grid items-center gap-10 py-14 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-0`}>
        <div className="animate-[fade_.9s_ease-out_both] lg:py-24">
          <h1 className="hero-title" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h1>
          {L(d.text, lang) && <p className="mt-6 max-w-lg text-base leading-relaxed text-white/80">{L(d.text, lang)}</p>}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {L(d.cta1Label, lang) && <SmartLink href={d.cta1Href} className="btn btn-saffron h-12 px-7 text-[0.9375rem]">{L(d.cta1Label, lang)}<Icon name="arrowR" size={16} /></SmartLink>}
            {L(d.cta2Label, lang) && <SmartLink href={d.cta2Href} className="btn btn-outline-light h-12 px-7 text-[0.9375rem]">{L(d.cta2Label, lang)}</SmartLink>}
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6">
            {stats.map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="display text-2xl font-semibold text-saffron sm:text-3xl">{s.n}</dd>
                <dd className="mt-1 text-xs leading-snug text-white/70">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {strip.length >= 6 && (
          <div className="hero-columns" aria-label={lang === "de" ? "Produkte aus dem Laden" : "Products from the shop"}>
            {cols.map((col, c) => (
              <div key={c} className={`hero-col ${c === 1 ? "hero-col-rev" : ""} ${c === 2 ? "hidden sm:block" : ""}`} style={{ ["--col-s" as string]: `${38 + c * 9}s` }}>
                <ul className="hero-col-track">
                  {col.map((im, i) => tile(im, `a${i}`, false))}
                  {col.map((im, i) => tile(im, `b${i}`, true))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
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
              <SmartLink href={t.href} className="tile group">
                <div className={`tile-img ${round ? "rounded-full" : ""}`}>
                  {t.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image} alt="" loading="lazy" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.06]" />
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
  const products = await getRailProducts(d.source, d.category || undefined, Number(d.limit) || 10, d.country || undefined);
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
          <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }}>
            {products.map((p, i) => <ProductCard key={p.id} p={p} lang={lang} badge={badge && i < 3 ? badge : undefined} />)}
          </Rail>
        )}
      </div>
    </section>
  );
}

// ---------- feature banners: big coloured panels ----------
function Banners({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  if (!items.length) return null;
  const tones = ["terra", "indigo", "forest"];
  return (
    <section className="band-paper py-16 sm:py-20">
      <div className={`${WRAP} grid gap-5 ${items.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {items.map((b, i) => {
          const tone = band(b.color && b.color !== "sand" ? b.color : tones[i % 3], "terra", true);
          return (
            <SmartLink key={i} href={b.href} className={`feature group ${tone}`}>
              <div className="relative z-10 flex max-w-[56%] flex-col">
                <h3 className="display text-2xl font-semibold leading-tight sm:text-[1.75rem]" style={{ textWrap: "balance" }}>{L(b.title, lang)}</h3>
                {L(b.text, lang) && <p className="mt-3 text-sm leading-relaxed opacity-80">{L(b.text, lang)}</p>}
                {L(b.ctaLabel, lang) && (
                  <span className="btn btn-light mt-6 self-start">{L(b.ctaLabel, lang)}<Icon name="arrowR" size={14} /></span>
                )}
              </div>
              {b.image && (
                <div className="feature-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image} alt="" loading="lazy" className="h-full w-full object-contain p-4 transition-transform duration-700 group-hover:scale-105" />
                </div>
              )}
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
                <Link href={`/shop?country=${encodeURIComponent(c.country)}`} className="country-chip">
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
          case "hero": return <Hero key={s.id} d={d} lang={lang} />;
          case "marquee": return <Marquee key={s.id} d={d} lang={lang} />;
          case "tiles": return <Tiles key={s.id} d={d} lang={lang} />;
          case "products": return <Products key={s.id} d={d} lang={lang} />;
          case "banners": return <Banners key={s.id} d={d} lang={lang} />;
          case "usp": return <Usp key={s.id} d={d} lang={lang} />;
          case "story": return <Story key={s.id} d={d} lang={lang} />;
          case "faq": return <Faq key={s.id} d={d} lang={lang} />;
          case "newsletter": return <Newsletter key={s.id} d={d} lang={lang} />;
          case "text": return <TextBlock key={s.id} d={d} lang={lang} />;
          case "countries": return <Countries key={s.id} d={d} lang={lang} />;
          case "recipes": return <Recipes key={s.id} d={d} lang={lang} />;
          default: return null;
        }
      })}
    </>
  );
}
