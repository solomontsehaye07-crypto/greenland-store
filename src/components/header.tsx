import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { getSite } from "@/lib/content";
import { supabasePublic } from "@/lib/supabase";
import { getLang, tx, ui } from "@/lib/i18n";
import { CartButton } from "./cart-button";
import { Announce } from "./announce";
import { LangSwitch } from "./lang-switch";
import { Icon } from "./icons";
import { img } from "@/lib/img";
import { SearchBox } from "./search-box";

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
  // the full logo with the name; the default one is trimmed top and bottom so the text is readable at header size
  const logoSrc = site.headerLogo || (site.logo?.startsWith("/brand/greenland-logo.svg") ? "/brand/greenland-logo-header.svg?v=3" : site.logo) || site.icon;
  const logo = logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoSrc} alt={name} width={176} height={51} className="h-9 w-auto sm:h-12 lg:h-[3.4rem]" />
  ) : (
    <span className="display text-lg font-semibold tracking-tight">{name.split(" ")[0]}<span className="text-forest">.</span></span>
  );
  const account = lang === "de" ? "Einloggen" : "Sign in";
  const highlights = [
    ...(saleCount ? [{ href: "/shop?sale=1", label: ui("offers", lang), hot: true }] : []),
    { href: "/shop?sort=new", label: lang === "de" ? "Neu" : "New" },
    { href: "/rezepte", label: ui("recipes", lang) },
    { href: "/laender", label: ui("countries", lang) },
    ...(site.navLinks ?? []).map((l) => ({ href: l.href || "/", label: tx(l.label, lang) })),
  ];
  return (
    <>
      <Announce items={announcements} />
      <header className="site-header sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-md transition-shadow">
        {/* row 1: menu (mobile) · logo · search · account · language · cart */}
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3 px-4 sm:gap-5">
          <details data-dismiss className="group lg:hidden">
            <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full hover:bg-surface" aria-label={ui("menu", lang)}>
              <Icon name="menu" size={22} />
            </summary>
            <nav className="fixed inset-x-0 top-[4.25rem] z-40 max-h-[calc(100vh-4.25rem)] overflow-y-auto border-t border-line bg-paper px-4 pb-10 pt-4 shadow-lg" aria-label={ui("menu", lang)}>
              <div className="mb-3 lg:hidden">
                <SearchBox lang={lang} variant="pill" label={ui("search", lang)} placeholder={ui("searchPlaceholder", lang)} />
              </div>
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
                {highlights.map((l) => <Link key={l.href} href={l.href} className={`block py-2 text-sm ${l.hot ? "font-semibold text-terra" : ""}`}>{l.label}</Link>)}
                <Link href="/account" className="block py-2 text-sm font-medium">{account}</Link>
                <div className="pt-3 sm:hidden"><LangSwitch lang={lang} /></div>
              </div>
            </nav>
          </details>

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${name} – ${ui("home", lang)}`}>{logo}</Link>

          <div className="hidden flex-1 lg:flex">
            <SearchBox lang={lang} variant="bar" label={ui("search", lang)} placeholder={ui("searchPlaceholder", lang)} />
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
            <Link href="/search" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface lg:hidden" aria-label={ui("search", lang)}>
              <Icon name="search" size={21} />
            </Link>
            <Link href="/account" className="flex h-11 items-center gap-2 rounded-full px-2 text-[0.8125rem] font-semibold uppercase tracking-wide hover:bg-surface sm:px-3" aria-label={account} title={account}>
              <span className="hidden sm:inline">{account}</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            </Link>
            <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />
            <div className="hidden px-1 sm:block"><LangSwitch lang={lang} /></div>
            <CartButton label={ui("cart", lang)} />
          </div>
        </div>

        {/* row 2 (desktop): categories with drop-downs · highlights on the right */}
        <nav className="hidden border-t border-line/70 lg:block" aria-label={ui("shop", lang)}>
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
            <ul className="flex items-center gap-1 text-[0.9375rem]">
              <li><Link href="/shop" className="block rounded-full px-3 py-3 font-medium hover:bg-surface">{ui("shopAll", lang)}</Link></li>
              {tree.map((d) => (
                <li key={d.id} className="group relative">
                  <Link href={`/c/${d.slug}`} className="block rounded-full px-3 py-3 font-medium hover:bg-surface">{catTitle(d)}</Link>
                  <div className="invisible absolute left-0 top-full z-40 pt-1 opacity-0 transition-opacity duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="grid w-[32rem] grid-cols-2 gap-x-6 gap-y-0.5 rounded-2xl border border-line bg-white p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,.25)]">
                      {d.children.map((c) => (
                        <li key={c.id}>
                          <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[0.875rem] hover:bg-surface">
                            {c.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img(c.image_url, 64)} alt="" className="h-9 w-9 rounded-lg bg-surface object-cover" loading="lazy" />
                            )}
                            {catTitle(c)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="ml-auto flex items-center gap-1 text-[0.9375rem]">
              {highlights.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={`block rounded-full px-3 py-3 font-medium hover:bg-surface ${l.hot ? "text-terra" : ""}`}>
                    {l.hot && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-terra align-middle" />}
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
}
