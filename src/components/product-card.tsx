import Link from "next/link";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import type { CardProduct } from "@/lib/catalog";
import type { Lang } from "@/lib/i18n";
import { ui } from "@/lib/i18n";
import { AddToCart } from "./add-to-cart";

export function productTitle(p: { title: string; title_de?: string | null }, lang: Lang) {
  return lang === "de" ? p.title_de || p.title : p.title;
}

export function ProductCard({ p, lang = "de", badge }: { p: CardProduct; lang?: Lang; badge?: string }) {
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const out = p.stock <= 0;
  const title = productTitle(p, lang);
  const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
  const tags = [sale > 0 ? `−${sale}%` : null, badge ?? null, p.is_frozen ? ui("frozen", lang) : null, p.age_restricted ? "18+" : null].filter(Boolean) as string[];
  return (
    <article className="group relative flex flex-col">
      <Link href={`/p/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-lg bg-surface">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={title} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">{ui("noPhoto", lang)}</div>
        )}
        {tags.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <span key={t} className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ${i === 0 && sale > 0 ? "bg-terra text-white" : "bg-white/90 text-ink"}`}>{t}</span>
            ))}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        {p.brand && <span className="truncate text-[0.6875rem] text-muted">{p.brand}</span>}
        <Link href={`/p/${p.slug}`} className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink after:absolute after:inset-0 after:content-[''] hover:underline">
          {title}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="leading-tight">
            <span className="text-sm font-semibold">{money(p.price)}</span>
            {sale > 0 && <span className="ml-1.5 text-xs text-muted line-through">{money(Number(p.compare_at_price))}</span>}
            {(base || size) && <div className="mt-0.5 text-[0.6875rem] text-muted">{[size, base].filter(Boolean).join(" · ")}</div>}
          </div>
          <div className="relative z-10">
            <AddToCart product={p} disabled={out} compact lang={lang} />
          </div>
        </div>
        {out && <span className="mt-1 text-[0.6875rem] text-danger">{ui("outOfStock", lang)}</span>}
      </div>
    </article>
  );
}

export function ProductGrid({ products, lang = "de" }: { products: CardProduct[]; lang?: Lang }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} lang={lang} />
      ))}
    </div>
  );
}
