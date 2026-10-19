import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { CartButton } from "./cart-button";

export async function Header() {
  const tree = await getCategoryTree();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="bg-green-deep px-4 py-1.5 text-center text-[0.8rem] text-white/90">
        Free delivery in Germany from 69 € — pickup in Kaiserslautern is always free
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-8">
        <Link href="/" className="shrink-0 leading-none" aria-label="Greenland Afro Asia Store – home">
          <span className="display block text-[1.6rem] font-extrabold text-green">Greenland</span>
          <span className="block text-[0.7rem] font-medium tracking-wide text-muted">Afro Asia Store</span>
        </Link>
        <form action="/search" className="relative hidden flex-1 sm:block" role="search">
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input id="q" name="q" placeholder="Search gari, palm oil, shea butter…" className="input rounded-full pl-10" />
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </form>
        <nav className="ml-auto flex items-center gap-1 sm:ml-0" aria-label="Account and cart">
          <Link href="/search" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface sm:hidden" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </Link>
          <CartButton />
        </nav>
      </div>
      <nav className="mx-auto max-w-7xl overflow-x-auto px-4 lg:overflow-visible" aria-label="Departments">
        <ul className="flex gap-1 pb-2 text-[0.95rem] font-medium">
          {tree.map((d) => (
            <li key={d.id} className="group relative">
              <Link href={`/c/${d.slug}`} className="block whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-surface">
                {d.title}
              </Link>
              <div className="invisible absolute left-0 top-full z-40 hidden lg:block w-[34rem] max-w-[90vw] rounded-2xl border border-line bg-white p-4 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {d.children.map((c) => (
                    <li key={c.id}>
                      <Link href={`/c/${c.slug}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
          <li>
            <Link href="/legal/versand" className="block whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface">
              Delivery & pickup
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
