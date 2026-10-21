import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { getSite } from "@/lib/content";
import { supabasePublic } from "@/lib/supabase";
import { getLang, tx, ui } from "@/lib/i18n";
import { CartButton } from "./cart-button";
import { Announce } from "./announce";
import { LangSwitch } from "./lang-switch";
import { Icon } from "./icons";

export async function Header() {
  const [tree, { site }, lang, { count: saleCount }] = await Promise.all([
    getCategoryTree(),
    getSite(),
    getLang(),
    supabasePublic().from("products").select("id", { count: "exact", head: true }).eq("status", "active").not("compare_at_price", "is", null),
  ]);
  const name = site.name || "Greenland";
  const announcements = (site.announcements ?? []).map((a) => tx(a.text, lang)).filter(Boolean);
  const catTitle = (c: { title: string; title_de: string | null }) => (lang === "de" ? c.title_de || c.title : c.title);
  const extra = [
    { href: "/laender", label: ui("countries", lang) },
    { href: "/rezepte", label: ui("recipes", lang) },
    // "Offers" appears as soon as at least one product has a compare-at (sale) price
    ...(saleCount ? [{ href: "/shop?sale=1", label: ui("offers", lang) }] : []),
    ...(site.navLinks ?? []).map((l) => ({ href: l.href || "/", label: tx(l.label, lang) })),
  ];
  const logoSrc = site.icon || site.logo;
  const logo = logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoSrc} alt={name} className="h-9 w-auto sm:h-10" />
  ) : (
    <span className="display text-lg font-semibold tracking-tight">{name.split(" ")[0]}<span className="text-forest">.</span></span>
  );
  return (
    <>
      <Announce items={announcements} />
      <header className="site-header sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md transition-shadow">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          {/* mobile menu, works without JavaScript */}
          <details data-dismiss className="group lg:hidden">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-surface" aria-label={ui("menu", lang)}>
              <Icon name="menu" size={20} />
            </summary>
            <nav className="fixed inset-x-0 top-[6.25rem] z-40 max-h-[calc(100vh-6.25rem)] overflow-y-auto border-t border-line bg-paper px-4 pb-10 pt-4 shadow-lg" aria-label={ui("menu", lang)}>
              <Link href="/shop" className="block py-2.5 text-sm font-medium">{ui("shopAll", lang)}</Link>
              {tree.map((d) => (
                <div key={d.id} className="border-t border-line py-2">
                  <Link href={`/c/${d.slug}`} className="block py-1.5 text-sm font-medium">{catTitle(d)}</Link>
                  <ul className="grid grid-cols-2 gap-x-4 pb-1">
                    {d.children.map((c) => (
                      <li key={c.id}><Link href={`/c/${c.slug}`} className="block py-1 text-[0.8125rem] text-muted">{catTitle(c)}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="border-t border-line pt-2">
                {extra.map((l) => <Link key={l.href} href={l.href} className="block py-2 text-sm">{l.label}</Link>)}
              </div>
            </nav>
          </details>

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${name} – ${ui("home", lang)}`}>{logo}</Link>

          <nav className="hidden flex-1 lg:block" aria-label={ui("shop", lang)}>
            <ul className="flex items-center gap-1 text-[0.8125rem]">
              <li><Link href="/shop" className="rounded-full px-3 py-2 hover:bg-surface">{ui("shopAll", lang)}</Link></li>
              {tree.map((d) => (
                <li key={d.id} className="group relative">
                  <Link href={`/c/${d.slug}`} className="rounded-full px-3 py-2 hover:bg-surface">{catTitle(d)}</Link>
                  <div className="invisible absolute left-0 top-full z-40 pt-3 opacity-0 transition-opacity duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="grid w-[30rem] grid-cols-2 gap-x-6 gap-y-0.5 rounded-xl border border-line bg-white p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,.25)]">
                      {d.children.map((c) => (
                        <li key={c.id}>
                          <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[0.8125rem] hover:bg-surface">
                            {c.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.image_url} alt="" className="h-8 w-8 rounded-md bg-surface object-cover" loading="lazy" />
                            )}
                            {catTitle(c)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
              <li aria-hidden className="mx-2 h-4 w-px bg-line" />
              {extra.map((l) => (
                <li key={l.href}><Link href={l.href} className="rounded-full px-3 py-2 text-muted hover:bg-surface hover:text-ink">{l.label}</Link></li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <details data-dismiss className="group relative">
              <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-surface" aria-label={ui("search", lang)}>
                <Icon name="search" size={19} />
              </summary>
              <form action="/search" role="search" className="fixed inset-x-0 top-[6.25rem] z-40 border-b border-line bg-paper px-4 py-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:rounded-xl sm:border sm:shadow-lg">
                <label htmlFor="q" className="sr-only">{ui("search", lang)}</label>
                <input id="q" name="q" autoFocus placeholder={ui("searchPlaceholder", lang)} className="input rounded-full" />
              </form>
            </details>
            <div className="px-2"><LangSwitch lang={lang} /></div>
            <CartButton label={ui("cart", lang)} />
          </div>
        </div>
      </header>
    </>
  );
}
