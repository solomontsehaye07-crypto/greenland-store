import Link from "next/link";
import { getCategoryTree, getHomeShelves, type CardProduct } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export const revalidate = 300;

function Shelf({ title, href, products }: { title: string; href: string; products: CardProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto mt-20 max-w-7xl px-4">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
        <Link href={href} className="shrink-0 text-sm font-semibold text-green underline-offset-4 hover:underline">
          See all
        </Link>
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

const DEPT_COPY: Record<string, string> = {
  food: "Gari, fufu flours, egusi, palm oil, stockfish, spices, frozen fish and more.",
  beauty: "Hair care, relaxers, natural oils, black soap and skin care you won't find at the drugstore.",
  "home-deco": "Jebena coffee pots, ceremony sets, clay pottery and serving trays.",
};

export default async function Home() {
  const [tree, shelves] = await Promise.all([getCategoryTree(), getHomeShelves()]);
  const mosaic = [...shelves.fufu.products, ...shelves.spices.products, ...shelves.hair.products, ...shelves.coffee.products]
    .filter((p) => p.image_url)
    .slice(0, 6);

  return (
    <>
      {/* Hero: the shelf itself is the picture */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-6 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <h1 className="text-[clamp(2.6rem,6.5vw,5.4rem)] font-extrabold text-ink">
            The taste of home, from Accra to Addis to Manila.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg text-muted">
            Over 780 groceries, beauty products and home goods from Africa, Asia and Latin America. Shipped across Germany, delivered
            locally in Kaiserslautern, or ready for pickup.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/c/food" className="btn btn-primary px-6 py-3 text-base">
              Shop groceries
            </Link>
            <Link href="/c/beauty" className="btn btn-ghost px-6 py-3 text-base">
              Shop beauty
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {mosaic.map((p, i) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              tabIndex={-1}
              className={`overflow-hidden rounded-3xl bg-white ${i % 3 === 1 ? "translate-y-6" : ""} ${i === 0 ? "bg-gold/40" : i === 4 ? "bg-surface" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url!} alt="" className="aspect-[4/5] w-full object-contain p-3" />
            </Link>
          ))}
        </div>
      </section>

      {/* Departments */}
      <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="dept-h">
        <h2 id="dept-h" className="sr-only">
          Departments
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tree.map((d, i) => (
            <div key={d.id} className={`rounded-3xl p-7 ${i === 0 ? "bg-green text-white" : i === 1 ? "bg-surface" : "bg-white"}`}>
              <Link href={`/c/${d.slug}`} className="group">
                <h3 className="text-3xl font-bold group-hover:underline">{d.title}</h3>
              </Link>
              <p className={`mt-2 text-sm ${i === 0 ? "text-white/80" : "text-muted"}`}>{DEPT_COPY[d.slug]}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {d.children.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/c/${c.slug}`}
                      className={`inline-block rounded-full px-3 py-1 text-sm ${i === 0 ? "bg-white/10 hover:bg-white/20" : "bg-paper hover:bg-white"}`}
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Shelf title="Fufu, flours & baking" href="/c/flours-fufu" products={shelves.fufu.products} />
      <Shelf title="Spices & seasonings" href="/c/spices-seasonings" products={shelves.spices.products} />

      {/* Ways to get your order – options, not steps */}
      <section className="mx-auto mt-24 max-w-7xl px-4">
        <div className="rounded-3xl bg-green-deep px-6 py-10 text-white sm:px-10">
          <h2 className="text-3xl font-bold sm:text-4xl">Four ways to get your order</h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Standard delivery", "5.99 € with DHL, 2–3 working days. Free from 69 €."],
              ["Frozen express", "Insulated box with cooling packs, next working day. 19.99 €, minimum order 50 €."],
              ["Local delivery", "Kaiserslautern and around, same or next day. 3.99 €, free from 40 €."],
              ["Pickup in store", "Order online, collect in Kaiserslautern. Always free, pay online or cash."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-lg font-bold text-gold">{t}</dt>
                <dd className="mt-1 text-sm text-white/80">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Shelf title="Hair care" href="/c/hair-care" products={shelves.hair.products} />

      {shelves.coffee.products.length > 0 && (
        <section className="mx-auto mt-24 grid max-w-7xl gap-8 px-4 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Coffee ceremony at home</h2>
            <p className="mt-4 max-w-md text-muted">
              Clay jebena pots, porcelain cups and gold display stands for the Ethiopian and Eritrean coffee ceremony — plus the beans,
              incense and snacks that go with it.
            </p>
            <Link href="/c/coffee-ceremony" className="btn btn-primary mt-6">
              Browse ceremony sets
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shelves.coffee.products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <Shelf title="From the freezer" href="/c/frozen" products={shelves.frozen.products} />
    </>
  );
}
