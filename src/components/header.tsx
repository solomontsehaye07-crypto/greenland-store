import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { getSite } from "@/lib/content";
import { getLang, tx, ui } from "@/lib/i18n";
import { CartButton } from "./cart-button";
import { Announce } from "./announce";
import { LangSwitch } from "./lang-switch";
import { Icon } from "./icons";

const DEPT_COLOR: Record<string, string> = { food: "bg-terra", beauty: "bg-indigo", home: "bg-forest" };

export async function Header() {
  const [tree, { site }, lang] = await Promise.all([getCategoryTree(), getSite(), getLang()]);
  const name = site.name || "Greenland";
  const tagline = tx(site.tagline, lang) || "Afro Asia Store";
  const announcements = (site.announcements ?? []).map((a) => tx(a.text, lang)).filter(Boolean);
  const catTitle = (c: { title: string; title_de: string | null }) => (lang === "de" ? c.title_de || c.title : c.title);
  return (
    <>
      <Announce items={announcements} />
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 leading-none" aria-label={`${name} – ${ui("home", lang)}`}>
            {site.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.logo} alt="" className="h-10 w-auto" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-forest text-lg font-extrabold text-paper display">G</span>
            )}
            <span>
              <span className="display block text-[1.45rem] font-extrabold text-forest">{name.split(" ")[0]}</span>
              <span className="block text-[0.7rem] font-medium text-muted">{tagline}</span>
            </span>
          </Link>
          <form action="/search" className="relative hidden flex-1 md:block" role="search">
            <label htmlFor="q" className="sr-only">{ui("search", lang)}</label>
            <input id="q" name="q" placeholder={ui("searchPlaceholder", lang)} className="input rounded-full border-transparent bg-surface pl-10" />
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          </form>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/search" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface md:hidden" aria-label={ui("search", lang)}>
              <Icon name="search" size={20} />
            </Link>
            <LangSwitch lang={lang} />
            <CartButton />
          </div>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 lg:overflow-visible" aria-label="Kategorien">
          <ul className="flex gap-1 pb-2 text-[0.95rem] font-medium">
            {tree.map((d) => (
              <li key={d.id} className="group relative">
                <Link href={`/c/${d.slug}`} className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-surface">
                  <span className={`h-2 w-2 rounded-full ${DEPT_COLOR[d.department] ?? "bg-forest"}`} aria-hidden />
                  {catTitle(d)}
                </Link>
                <div className="invisible absolute left-0 top-full z-40 hidden w-[36rem] max-w-[90vw] rounded-2xl border border-line bg-paper p-4 opacity-0 shadow-xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 lg:block">
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {d.children.map((c) => (
                      <li key={c.id}>
                        <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-surface">
                          {c.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image_url} alt="" className="h-9 w-9 rounded-lg bg-white object-cover" loading="lazy" />
                          )}
                          {catTitle(c)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
            {(site.navLinks ?? []).map((l, i) => (
              <li key={i}>
                <Link href={l.href || "/"} className="block whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-surface">
                  {tx(l.label, lang)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/info/lieferung" className="block whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface">
                {ui("deliveryPickup", lang)}
              </Link>
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}
