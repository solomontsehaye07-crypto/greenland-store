import Link from "next/link";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import type { CardProduct } from "@/lib/catalog";
import type { Lang } from "@/lib/i18n";
import { ui } from "@/lib/i18n";
import { AddToCart } from "./add-to-cart";

export function productTitle(p: { title: string; title_de?: string | null }, lang: Lang) {
  return lang === "de" ? p.title_de || p.title : p.title;
}

export function ProductCard({ p, lang = "de" }: { p: CardProduct; lang?: Lang }) {
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const out = p.stock <= 0;
  const title = productTitle(p, lang);
  const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
  return (
    <article className="group flex flex-col rounded-[1.4rem] bg-white p-2.5 ring-1 ring-line transition-shadow hover:shadow-[0_14px_30px_-18px_rgba(35,27,22,.45)]">
      <Link href={`/p/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-surface">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">{ui("noPhoto", lang)}</div>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {sale > 0 && <span className="rounded-full bg-terra px-2.5 py-1 text-xs font-bold text-white">−{sale}%</span>}
          {p.is_frozen && <span className="rounded-full bg-indigo px-2.5 py-1 text-xs font-semibold text-white">{ui("frozen", lang)}</span>}
          {p.age_restricted && <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">18+</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-1.5 pb-1">
        <Link href={`/p/${p.slug}`} className="mt-3 line-clamp-2 text-[0.93rem] font-medium leading-snug hover:text-forest">
          {title}
        </Link>
        {size && <span className="mt-0.5 text-sm text-muted">{size}</span>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold">{money(p.price)}</span>
              {sale > 0 && <span className="text-sm text-muted line-through">{money(Number(p.compare_at_price))}</span>}
            </div>
            {base && <div className="text-xs text-muted">{base}</div>}
          </div>
          <AddToCart product={p} disabled={out} compact lang={lang} />
        </div>
        {out && <span className="mt-1 text-xs font-medium text-danger">{ui("outOfStock", lang)}</span>}
      </div>
    </article>
  );
}

export function ProductGrid({ products, lang = "de" }: { products: CardProduct[]; lang?: Lang }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} lang={lang} />
      ))}
    </div>
  );
}
