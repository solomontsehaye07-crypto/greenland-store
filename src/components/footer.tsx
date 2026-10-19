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
  const social = [["instagram", site.instagram], ["facebook", site.facebook], ["tiktok", site.tiktok]].filter(([, v]) => v) as [string, string][];
  const col = "text-[0.8125rem] text-muted";
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          {site.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logo} alt={name} className="h-20 w-auto" loading="lazy" />
          ) : (
            <span className="display text-base font-semibold">{name}</span>
          )}
          {tx(site.about, lang) && <p className={`mt-2 ${col} leading-relaxed`}>{tx(site.about, lang)}</p>}
          {site.whatsapp && (
            <a href={`https://wa.me/${site.whatsapp}`} rel="noopener" className="mt-4 inline-flex items-center gap-2 text-[0.8125rem] font-medium text-forest hover:underline">
              <Icon name="whatsapp" size={16} /> {ui("writeUs", lang)}
            </a>
          )}
          {social.length > 0 && (
            <div className="mt-4 flex gap-1">
              {social.map(([k, v]) => (
                <a key={k} href={v} aria-label={k} rel="noopener" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"><Icon name={k} size={17} /></a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold">{ui("shop", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            <li><Link href="/shop" className="hover:text-ink">{ui("shopAll", lang)}</Link></li>
            {tree.map((d) => <li key={d.id}><Link href={`/c/${d.slug}`} className="hover:text-ink">{lang === "de" ? d.title_de || d.title : d.title}</Link></li>)}
            <li><Link href="/laender" className="hover:text-ink">{ui("countries", lang)}</Link></li>
            <li><Link href="/rezepte" className="hover:text-ink">{ui("recipes", lang)}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold">{ui("help", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {pages.map((p) => <li key={p.slug}><Link href={`/info/${p.slug}`} className="hover:text-ink">{tx(p.title, lang)}</Link></li>)}
            {site.phone && <li>{site.phone}</li>}
            {site.email && <li><a href={`mailto:${site.email}`} className="hover:text-ink">{site.email}</a></li>}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold">{ui("legal", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {LEGAL.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-ink">{tx(l.label, lang)}</Link></li>)}
          </ul>
          {tx(site.address, lang) && <p className={`mt-5 whitespace-pre-line ${col}`}>{tx(site.address, lang)}</p>}
          {tx(site.hours, lang) && <p className={`mt-2 whitespace-pre-line ${col}`}>{tx(site.hours, lang)}</p>}
        </div>
      </div>
      <div className="mx-auto max-w-7xl border-t border-line px-4 py-6 text-[0.6875rem] text-muted">
        {ui("vatNote", lang)} © {new Date().getFullYear()} {name}
      </div>
    </footer>
  );
}
