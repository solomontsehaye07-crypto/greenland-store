import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { getFooterPages, getSite } from "@/lib/content";
import { getLang, tx, ui } from "@/lib/i18n";
import { Icon } from "./icons";

const LEGAL = [
  { href: "/legal/impressum", label: { de: "Impressum", en: "Legal notice" } },
  { href: "/legal/agb", label: { de: "AGB", en: "Terms" } },
  { href: "/legal/datenschutz", label: { de: "Datenschutz", en: "Privacy" } },
  { href: "/legal/widerruf", label: { de: "Widerruf", en: "Returns" } },
];

export async function Footer() {
  const [{ site }, pages, tree, lang] = await Promise.all([getSite(), getFooterPages(), getCategoryTree(), getLang()]);
  const name = site.name || "Greenland Afro Asia Store";
  const social = [
    ["instagram", site.instagram],
    ["facebook", site.facebook],
    ["tiktok", site.tiktok],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="weave" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <span className="display text-3xl font-extrabold">{name}</span>
          {tx(site.about, lang) && <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper/75">{tx(site.about, lang)}</p>}
          {site.whatsapp && (
            <a href={`https://wa.me/${site.whatsapp}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-sm font-semibold text-ink hover:brightness-105" rel="noopener">
              <Icon name="whatsapp" size={18} /> {ui("writeUs", lang)}
            </a>
          )}
          {social.length > 0 && (
            <div className="mt-5 flex gap-2">
              {social.map(([k, v]) => (
                <a key={k} href={v} aria-label={k} rel="noopener" className="grid h-10 w-10 place-items-center rounded-full border border-paper/25 hover:border-saffron hover:text-saffron">
                  <Icon name={k} size={18} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-saffron">{ui("shop", lang)}</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/80">
            {tree.map((d) => (
              <li key={d.id}><Link href={`/c/${d.slug}`} className="hover:text-paper">{lang === "de" ? d.title_de || d.title : d.title}</Link></li>
            ))}
            <li><Link href="/search" className="hover:text-paper">{ui("allProducts", lang)}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold text-saffron">{ui("help", lang)}</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/80">
            {pages.map((p) => (
              <li key={p.slug}><Link href={`/info/${p.slug}`} className="hover:text-paper">{tx(p.title, lang)}</Link></li>
            ))}
            {site.phone && <li>{site.phone}</li>}
            {site.email && <li><a href={`mailto:${site.email}`} className="hover:text-paper">{site.email}</a></li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold text-saffron">{ui("legal", lang)}</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/80">
            {LEGAL.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-paper">{tx(l.label, lang)}</Link></li>
            ))}
          </ul>
          {tx(site.address, lang) && <p className="mt-5 whitespace-pre-line text-sm text-paper/70">{tx(site.address, lang)}</p>}
          {tx(site.hours, lang) && <p className="mt-3 whitespace-pre-line text-sm text-paper/70">{tx(site.hours, lang)}</p>}
        </div>
      </div>
      <div className="border-t border-paper/15 px-4 py-5 text-center text-xs text-paper/60">
        {ui("vatNote", lang)} © {new Date().getFullYear()} {name}
      </div>
    </footer>
  );
}
