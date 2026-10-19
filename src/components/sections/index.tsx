import Link from "next/link";
import type { HomeSection } from "@/lib/content";
import { getRailProducts, getCategories } from "@/lib/catalog";
import { tx, ui, type L10n, type Lang } from "@/lib/i18n";
import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { ProductCard } from "../product-card";
import { Rail } from "./rail";
import { NewsletterForm } from "./newsletter-form";

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const L = (v: unknown, lang: Lang) => tx(v as L10n, lang);
const accent = (c?: string) => `accent-${c || "sand"}`;

function SmartLink({ href, className, children, ...rest }: { href?: string; className?: string; children: React.ReactNode; "aria-label"?: string }) {
  const h = href || "/";
  if (/^https?:\/\//.test(h)) return <a href={h} className={className} rel="noopener" {...rest}>{children}</a>;
  return <Link href={h} className={className} {...rest}>{children}</Link>;
}

function Head({ title, text, lang, link }: { title?: unknown; text?: unknown; lang: Lang; link?: { href: string; label: string } }) {
  const t = L(title, lang);
  const p = L(text, lang);
  if (!t && !p) return null;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {t && <h2 className="text-3xl font-extrabold sm:text-[2.6rem]" style={{ textWrap: "balance" }}>{t}</h2>}
        {p && <p className="mt-2 text-muted">{p}</p>}
      </div>
      {link && <Link href={link.href} className="rounded-full border border-current px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper">{link.label}</Link>}
    </div>
  );
}

// ---------- hero ----------
function Hero({ d, lang }: { d: D; lang: Lang }) {
  const imgs: { image?: string; href?: string }[] = (d.images ?? []).filter((x: D) => x.image).slice(0, 5);
  const shapes = ["arch", "rounded-full", "rounded-[2rem]", "arch", "rounded-full"];
  const tones = ["bg-terra", "bg-saffron", "bg-indigo", "bg-forest", "bg-sand"];
  // a staggered 2-column collage, the middle column offset to feel like market stalls
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-16">
        <div className="relative z-10">
          <h1 className="display text-[2.9rem] font-extrabold leading-[0.98] sm:text-6xl lg:text-[4.6rem]" style={{ textWrap: "balance" }}>
            {L(d.title, lang)}
          </h1>
          {L(d.text, lang) && <p className="mt-6 max-w-xl text-lg text-muted">{L(d.text, lang)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {L(d.cta1Label, lang) && (
              <SmartLink href={d.cta1Href} className="btn bg-terra px-7 py-3.5 text-base text-white hover:brightness-110">{L(d.cta1Label, lang)}</SmartLink>
            )}
            {L(d.cta2Label, lang) && (
              <SmartLink href={d.cta2Href} className="btn border-2 border-ink px-7 py-3.5 text-base hover:bg-ink hover:text-paper">{L(d.cta2Label, lang)}</SmartLink>
            )}
          </div>
          {(d.facts ?? []).length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {(d.facts as D[]).map((f, i) => (
                <li key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-saffron" aria-hidden />{L(f.text, lang)}</li>
              ))}
            </ul>
          )}
        </div>
        {imgs.length > 0 && (
          <div className="relative grid grid-cols-3 items-end gap-3 sm:gap-4" aria-hidden={false}>
            {imgs.map((im, i) => {
              const big = i === 1;
              const el = (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={im.image} alt="" className="h-full w-full object-cover mix-blend-multiply" loading={i < 3 ? "eager" : "lazy"} />
              );
              return (
                <div
                  key={i}
                  className={`rise relative overflow-hidden ${shapes[i]} ${tones[i]} ${big ? "row-span-2 aspect-[3/5]" : "aspect-[3/4]"} ${i % 2 ? "drift" : ""}`}
                  style={{ animationDelay: `${120 + i * 110}ms` }}
                >
                  <div className="absolute inset-[6px] overflow-hidden rounded-[inherit] bg-white">{im.href ? <SmartLink href={im.href} className="block h-full">{el}</SmartLink> : el}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- marquee ----------
function Marquee({ d, lang }: { d: D; lang: Lang }) {
  const items: string[] = (d.items ?? []).map((x: D) => L(x.text, lang)).filter(Boolean);
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((t, i) => (
        <li key={i} className="flex items-center whitespace-nowrap px-6 text-lg font-bold display sm:text-xl">
          {t}
          <span className="ml-12 inline-block h-3 w-3 rotate-45 bg-current opacity-60" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <section className={`marquee overflow-hidden py-4 ${accent(d.color)}`} style={{ ["--marquee-s" as string]: `${Number(d.seconds) || 40}s` }}>
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </section>
  );
}

// ---------- tiles ----------
function Tiles({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  const shape = d.shape === "circle" ? "rounded-full aspect-square" : d.shape === "square" ? "rounded-[1.6rem] aspect-square" : "arch aspect-[4/5]";
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <Head title={d.title} text={d.text} lang={lang} />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((t, i) => (
          <li key={i}>
            <SmartLink href={t.href} className="group block text-center">
              <div className={`relative overflow-hidden ${shape} ${accent(t.color)}`}>
                {t.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" loading="lazy" className="absolute inset-[7px] h-[calc(100%-14px)] w-[calc(100%-14px)] rounded-[inherit] object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
              </div>
              <span className="mt-3 block text-[0.95rem] font-semibold leading-tight group-hover:text-terra">{L(t.label, lang)}</span>
            </SmartLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- product rail ----------
async function Products({ d, lang }: { d: D; lang: Lang }) {
  const products = await getRailProducts(d.source, d.category, Number(d.limit) || 10);
  if (!products.length) return null;
  let link: { href: string; label: string } | undefined;
  if (d.source === "category" && d.category) link = { href: `/c/${d.category}`, label: ui("seeAll", lang) };
  const tinted = d.color && d.color !== "none";
  return (
    <section className={tinted ? `${accent(d.color)} py-14` : "py-12"}>
      <div className="mx-auto max-w-7xl px-4">
        <Head title={d.title} text={d.text} lang={lang} link={link} />
        <Rail labels={{ prev: ui("prev", lang), next: ui("next", lang) }}>
          {products.map((p) => <ProductCard key={p.id} p={p} lang={lang} />)}
        </Rail>
      </div>
    </section>
  );
}

// ---------- banners ----------
function Banners({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className={`grid gap-4 ${items.length > 1 ? "md:grid-cols-2" : ""} ${items.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {items.map((b, i) => (
          <SmartLink key={i} href={b.href} className={`group relative flex min-h-[18rem] overflow-hidden rounded-[2rem] ${accent(b.color)}`}>
            <div className="relative z-10 flex max-w-[60%] flex-col justify-end p-7">
              <h3 className="display text-2xl font-extrabold leading-tight sm:text-3xl" style={{ textWrap: "balance" }}>{L(b.title, lang)}</h3>
              {L(b.text, lang) && <p className="mt-2 text-sm opacity-85">{L(b.text, lang)}</p>}
              {L(b.ctaLabel, lang) && (
                <span className="mt-5 inline-flex w-fit rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">{L(b.ctaLabel, lang)}</span>
              )}
            </div>
            {b.image && (
              <div className="absolute -right-6 bottom-0 top-6 w-[52%] overflow-hidden arch bg-paper/20 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" loading="lazy" className="h-full w-full rounded-[inherit] object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
            )}
          </SmartLink>
        ))}
      </div>
    </section>
  );
}

// ---------- usp ----------
function Usp({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  const tones = ["text-terra", "text-forest", "text-indigo", "text-saffron"];
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <Head title={d.title} lang={lang} />
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((u, i) => (
          <li key={i} className="flex gap-4">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface ${tones[i % 4]}`}><Icon name={u.icon} size={24} /></span>
            <div>
              <h3 className="font-bold">{L(u.title, lang)}</h3>
              <p className="mt-1 text-sm text-muted">{L(u.text, lang)}</p>
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
  const tinted = d.color && d.color !== "none";
  return (
    <section className={tinted ? `${accent(d.color)} my-10` : "my-10"}>
      <div className={`mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2`}>
        {d.image && (
          <div className={`relative ${right ? "md:order-2" : ""}`}>
            <div className="arch overflow-hidden bg-paper p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-[inherit] object-cover" />
            </div>
          </div>
        )}
        <div className="max-w-xl">
          <h2 className="display text-3xl font-extrabold sm:text-[2.6rem]" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
          <Markdown text={L(d.text, lang)} className="mt-5 text-[1.05rem]" />
          {L(d.ctaLabel, lang) && <SmartLink href={d.ctaHref} className="btn mt-7 bg-ink text-paper hover:brightness-125">{L(d.ctaLabel, lang)}</SmartLink>}
        </div>
      </div>
    </section>
  );
}

// ---------- faq ----------
function Faq({ d, lang }: { d: D; lang: Lang }) {
  const items: D[] = d.items ?? [];
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <Head title={d.title} lang={lang} />
      <div className="divide-y divide-line border-y border-line">
        {items.map((f, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
              {L(f.q, lang)}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-xl transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-muted">{L(f.a, lang)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------- newsletter ----------
function Newsletter({ d, lang }: { d: D; lang: Lang }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className={`relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 ${accent(d.color || "indigo")}`}>
        <div className="weave absolute inset-x-0 top-0" aria-hidden />
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="display text-3xl font-extrabold sm:text-4xl" style={{ textWrap: "balance" }}>{L(d.title, lang)}</h2>
            {L(d.text, lang) && <p className="mt-3 opacity-85">{L(d.text, lang)}</p>}
          </div>
          <div>
            <NewsletterForm lang={lang} button={L(d.buttonLabel, lang) || ui("subscribe", lang)} placeholder={ui("emailAddress", lang)} thanks={ui("thanksSubscribed", lang)} />
            {L(d.note, lang) && <p className="mt-3 text-xs opacity-75">{L(d.note, lang)}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TextBlock({ d, lang }: { d: D; lang: Lang }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      {L(d.title, lang) && <h2 className="display mb-4 text-3xl font-extrabold">{L(d.title, lang)}</h2>}
      <Markdown text={L(d.body, lang)} />
    </section>
  );
}

export async function Sections({ sections, lang }: { sections: HomeSection[]; lang: Lang }) {
  await getCategories(); // warm the category cache once for all product rows
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
          default: return null;
        }
      })}
    </>
  );
}
