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

function SmartLink({ href, className, children, ...rest }: { href?: string; className?: string; children: React.ReactNode; "aria-label"?: string }) {
  const h = href || "/";
  if (/^https?:\/\//.test(h)) return <a href={h} className={className} rel="noopener" {...rest}>{children}</a>;
  return <Link href={h} className={className} {...rest}>{children}</Link>;
}

function Head({ title, text, lang, link }: { title?: unknown; text?: unknown; lang: Lang; link?: { href: string; label: string } }) {
  const t = L(title, lang);
  const p = L(text, lang);
  if (!t && !p && !link) return null;
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="max-w-xl">
        {t && <h2 className="h-section" style={{ textWrap: "balance" }}>{t}</h2>}
        {p && <p className="mt-1.5 text-sm text-muted">{p}</p>}
      </div>
      {link && <Link href={link.href} className="link-more">{link.label}</Link>}
    </div>
  );
}

// ---------- hero: short headline + endless product strip ----------
async function Hero({ d, lang }: { d: D; lang: Lang }) {
  let strip: { image: string; href?: string }[] = (d.images ?? []).filter((x: D) => x.image);
  if (d.autoFill !== false && strip.length < 10) {
    const rec = await getRecommended(14 - strip.length);
    strip = [...strip, ...rec.filter((p) => p.image_url).map((p) => ({ image: p.image_url as string, href: `/p/${p.slug}` }))];
  }
  const tile = (im: { image: string; href?: string }, i: number, hidden: boolean) => {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={im.image} alt="" loading={i < 6 ? "eager" : "lazy"} className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.04]" />
    );
    return (
      <li key={`${hidden ? "b" : "a"}${i}`} className="group mr-4 h-44 w-44 shrink-0 overflow-hidden rounded-xl bg-surface sm:h-56 sm:w-56" aria-hidden={hidden}>
        {im.href ? <SmartLink href={im.href} className="block h-full" aria-label={hidden ? undefined : `${i + 1}`}>{img}</SmartLink> : img}
      </li>
    );
  };
  return (
    <section className="overflow-hidden pb-16 pt-14 sm:pt-20">
      <div className={`${WRAP} animate-[fade_.9s_ease-out_both]`}>
        <h1 className="display max-w-3xl text-[2.1rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl" style={{ textWrap: "balance" }}>
          {L(d.title, lang)}
        </h1>
        {L(d.text, lang) && <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted">{L(d.text, lang)}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {L(d.cta1Label, lang) && <SmartLink href={d.cta1Href} className="btn btn-primary px-6">{L(d.cta1Label, lang)}</SmartLink>}
          {L(d.cta2Label, lang) && <SmartLink href={d.cta2Href} className="btn btn-ghost px-6">{L(d.cta2Label, lang)}</SmartLink>}
        </div>
        {(d.facts ?? []).length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
            {(d.facts as D[]).map((f, i) => (
              <li key={i} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-forest" aria-hidden />{L(f.text, lang)}</li>
            ))}
          </ul>
        )}
      </div>
      {strip.length > 0 && (
        <div className="marquee mt-14" style={{ ["--marquee-s" as string]: `${Math.max(40, strip.length * 6)}s` }}>
          <ul className="marquee-track">
            {strip.map((im, i) => tile(im, i, false))}
            {strip.map((im, i) => tile(im, i, true))}
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
        <li key={i} className="flex items-center whitespace-nowrap px-8 text-xs text-muted">
          {t}<span className="ml-16 h-1 w-1 rounded-full bg-line" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <section className="marquee overflow-hidden border-y border-line py-3" style={{ ["--marquee-s" as string]: `${Number(d.seconds) || 45}s` }}>
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </section>
  );
}

// ---------- category tiles ----------
function Tiles({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  const shape = d.shape === "circle" ? "rounded-full aspect-square" : d.shape === "portrait" ? "rounded-xl aspect-[4/5]" : "rounded-xl aspect-square";
  return (
    <section className={`${WRAP} reveal py-14`}>
      <Head title={d.title} text={d.text} lang={lang} />
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((t, i) => (
          <li key={i}>
            <SmartLink href={t.href} className="group block">
              <div className={`overflow-hidden bg-surface ${shape}`}>
                {t.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.04]" />
                )}
              </div>
              <span className="mt-2.5 block text-center text-xs text-ink group-hover:underline sm:text-[0.8125rem]">{L(t.label, lang)}</span>
            </SmartLink>
          </li>
        ))}
      </ul>
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
  const tinted = d.color && d.color !== "none";
  const badge = d.source === "bestsellers" ? ui("bestseller", lang) : undefined;
  return (
    <section className={`reveal ${tinted ? "bg-surface py-16" : "py-12"}`}>
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

// ---------- banners (editorial cards) ----------
function Banners({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  if (!items.length) return null;
  return (
    <section className={`${WRAP} reveal py-12`}>
      <div className={`grid gap-6 ${items.length > 1 ? "md:grid-cols-2" : ""} ${items.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {items.map((b, i) => (
          <SmartLink key={i} href={b.href} className="group block">
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-surface">
              {b.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.03]" />
              )}
            </div>
            <h3 className="mt-4 text-base font-semibold">{L(b.title, lang)}</h3>
            {L(b.text, lang) && <p className="mt-1 text-sm text-muted">{L(b.text, lang)}</p>}
            {L(b.ctaLabel, lang) && <span className="link-more mt-2 inline-block">{L(b.ctaLabel, lang)}</span>}
          </SmartLink>
        ))}
      </div>
    </section>
  );
}

// ---------- promises ----------
function Usp({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  return (
    <section className={`${WRAP} reveal py-12`}>
      {L(d.title, lang) && <h2 className="sr-only">{L(d.title, lang)}</h2>}
      <ul className="grid gap-x-8 gap-y-6 border-y border-line py-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((u, i) => (
          <li key={i} className="flex gap-3">
            <Icon name={u.icon} size={20} className="mt-0.5 shrink-0 text-forest" />
            <div>
              <h3 className="text-[0.8125rem] font-semibold">{L(u.title, lang)}</h3>
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
  return (
    <section className={`${WRAP} reveal py-16`}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        {d.image && (
          <div className={`aspect-[4/5] overflow-hidden rounded-xl bg-surface md:aspect-square ${right ? "md:order-2" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply" />
          </div>
        )}
        <div className="max-w-md">
          <h2 className="h-section" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
          <Markdown text={L(d.text, lang)} className="mt-4 text-muted" />
          {L(d.ctaLabel, lang) && <SmartLink href={d.ctaHref} className="btn btn-ghost mt-6">{L(d.ctaLabel, lang)}</SmartLink>}
        </div>
      </div>
    </section>
  );
}

function Faq({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  return (
    <section className={`${WRAP} reveal py-14`}>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <Head title={d.title} lang={lang} />
        <div className="divide-y divide-line border-y border-line">
          {items.map((f, i) => (
            <details key={i} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {L(f.q, lang)}
                <span className="text-lg leading-none text-muted transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 whitespace-pre-line pr-8 text-sm leading-relaxed text-muted">{L(f.a, lang)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ d, lang }: { d: D; lang: Lang }) {
  return (
    <section className={`${WRAP} reveal py-12`}>
      <div className="rounded-2xl bg-surface px-6 py-12 text-center sm:px-12">
        <h2 className="h-section mx-auto max-w-lg" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
        {L(d.text, lang) && <p className="mt-2 text-sm text-muted">{L(d.text, lang)}</p>}
        <div className="mx-auto mt-6 max-w-md">
          <NewsletterForm lang={lang} button={L(d.buttonLabel, lang) || ui("subscribe", lang)} placeholder={ui("emailAddress", lang)} thanks={ui("thanksSubscribed", lang)} />
          {L(d.note, lang) && <p className="mt-3 text-[0.6875rem] text-muted">{L(d.note, lang)}</p>}
        </div>
      </div>
    </section>
  );
}

function TextBlock({ d, lang }: { d: D; lang: Lang }) {
  return (
    <section className="reveal mx-auto max-w-2xl px-4 py-12">
      {L(d.title, lang) && <h2 className="h-section mb-4">{L(d.title, lang)}</h2>}
      <Markdown text={L(d.body, lang)} />
    </section>
  );
}

// ---------- shop by country ----------
async function Countries({ d, lang }: { d: D; lang: Lang }) {
  const list = await getCountryCounts();
  if (!list.length) return null;
  return (
    <section className={`${WRAP} reveal py-12`}>
      <Head title={d.title} text={d.text} lang={lang} link={{ href: "/laender", label: ui("seeAll", lang) }} />
      <ul className="flex flex-wrap gap-2">
        {list.slice(0, 18).map((c) => {
          const flag = countryFlag(c.country);
          const name = countryLabel(c.country, lang);
          return (
            <li key={c.country}>
              <Link href={`/shop?country=${encodeURIComponent(c.country)}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[0.8125rem] transition-colors hover:border-ink">
                <span aria-hidden>{flag}</span>{name}<span className="text-xs text-muted">{c.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- recipe ideas ----------
async function Recipes({ d, lang }: { d: D; lang: Lang }) {
  const { data } = await supabasePublic()
    .from("recipes")
    .select("slug, title, intro, image_url, country, recipe_items(count)")
    .eq("published", true)
    .order("sort")
    .limit(Math.min(Number(d.limit) || 4, 8));
  const rows = (data ?? []) as { slug: string; title: L10n; intro: L10n; image_url: string | null; country: string | null; recipe_items: { count: number }[] }[];
  if (!rows.length) return null;
  return (
    <section className={`${WRAP} reveal py-14`}>
      <Head title={d.title} text={d.text} lang={lang} link={{ href: "/rezepte", label: ui("seeAll", lang) }} />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {rows.map((r) => (
          <li key={r.slug}>
            <Link href={`/rezepte/${r.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.04]" />
                )}
              </div>
              <h3 className="mt-3 text-sm font-semibold group-hover:underline">{tx(r.title, lang)}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{tx(r.intro, lang)}</p>
              <p className="mt-1.5 text-[0.6875rem] text-muted">
                {[r.country ? countryLabel(r.country, lang) : null, `${r.recipe_items?.[0]?.count ?? 0} ${lang === "de" ? "Zutaten im Shop" : "ingredients in store"}`].filter(Boolean).join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
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
