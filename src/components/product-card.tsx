import Link from "next/link";
import { money, sizeLabel, unitPrice } from "@/lib/format";
import type { CardProduct } from "@/lib/catalog";
import { AddToCart } from "./add-to-cart";

export function ProductCard({ p }: { p: CardProduct }) {
  const size = sizeLabel(p.size_qty, p.size_unit);
  const base = unitPrice(p.price, p.size_qty, p.size_unit);
  const out = p.stock <= 0;
  return (
    <article className="group flex flex-col">
      <Link href={`/p/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-white">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">No photo yet</div>
        )}
        {p.is_frozen && (
          <span className="absolute left-3 top-3 rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a]">Frozen</span>
        )}
        {p.age_restricted && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">18+</span>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <Link href={`/p/${p.slug}`} className="line-clamp-2 text-[0.95rem] font-medium leading-snug hover:text-green">
          {p.title}
        </Link>
        {size && <span className="mt-0.5 text-sm text-muted">{size}</span>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <div className="text-lg font-bold">{money(p.price)}</div>
            {base && <div className="text-xs text-muted">{base}</div>}
          </div>
          <AddToCart product={p} disabled={out} compact />
        </div>
        {out && <span className="mt-1 text-xs font-medium text-danger">Out of stock</span>}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: CardProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
