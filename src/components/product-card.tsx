import Link from "next/link";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import type { CardProduct } from "@/lib/catalog";
import type { Lang } from "@/lib/i18n";
import { ui } from "@/lib/i18n";
import { AddToCart } from "./add-to-cart";
import { countryFlag } from "@/lib/countries";

export function productTitle(p: { title: string; title_de?: string | null }, lang: Lang) {
  return lang === "de" ? p.title_de || p.title : p.title;
}

export function ProductCard({ p, lang = "de", badge }: { p: CardProduct; lang?: Lang; badge?: string }) {
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const out = p.stock <= 0;
  const title = productTitle(p, lang);
  const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
  const flag = p.country ? countryFlag(p.country) : "";
  return (
    <article className="pcard group relative flex flex-col">
      <Link href={`/p/${p.slug}`} className="pcard-img relative block aspect-square overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={title} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">{ui("noPhoto", lang)}</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
          {flag && <span className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-sm shadow-sm" title={p.country ?? ""} aria-hidden>{flag}</span>}
          {sale > 0 && <span className="rounded-full bg-terra px-2 py-0.5 text-[0.6875rem] font-bold text-white">Sale −{sale}%</span>}
          {badge && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink">{badge}</span>}
          {p.is_frozen && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-[#1c4c86]">❄ {ui("frozen", lang)}</span>}
        </div>
        {out && <span className="absolute right-2.5 top-2.5 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{ui("outOfStock", lang)}</span>}
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <Link href={`/p/${p.slug}`} className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink after:absolute after:inset-x-0 after:top-0 after:aspect-square after:content-['']">
          {title}
        </Link>
        <p className="mt-0.5 min-h-[1rem] text-xs text-muted">{[size, base].filter(Boolean).join(" · ") || p.brand || ""}</p>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className={`text-base font-bold ${sale > 0 ? "text-terra" : "text-ink"}`}>{money(p.price)}</span>
          {sale > 0 && <span className="text-xs text-muted line-through">{money(Number(p.compare_at_price))}</span>}
        </p>
        <div className="relative z-10 mt-auto pt-3">
          <AddToCart product={p} disabled={out} block lang={lang} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, lang = "de" }: { products: CardProduct[]; lang?: Lang }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} lang={lang} />
      ))}
    </div>
  );
}
