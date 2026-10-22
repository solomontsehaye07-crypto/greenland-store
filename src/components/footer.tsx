import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { getFooterPages, getSite } from "@/lib/content";
import { getLang, tx, ui } from "@/lib/i18n";
import { Icon } from "./icons";
import { getPaymentConfig } from "@/lib/commerce";
import { getCartPerks } from "@/lib/perks";
import { money } from "@/lib/format";

const LEGAL = [
  { href: "/legal/impressum", label: { de: "Impressum", en: "Legal notice" } },
  { href: "/legal/agb", label: { de: "AGB", en: "Terms" } },
  { href: "/legal/datenschutz", label: { de: "Datenschutz", en: "Privacy" } },
  { href: "/legal/widerruf", label: { de: "Widerruf", en: "Returns" } },
];

export async function Footer() {
  const [{ site }, pages, tree, lang, pay, perks] = await Promise.all([getSite(), getFooterPages(), getCategoryTree(), getLang(), getPaymentConfig(), getCartPerks()]);
  const de = lang === "de";
  const PAY: Record<string, string> = { stripe: de ? "Kreditkarte" : "Card", viva: de ? "Karte" : "Card", paypal: "PayPal", bank: de ? "Überweisung" : "Bank transfer", cash: de ? "Bar / Karte bei Abholung" : "Cash / card on pickup" };
  const payments = [...new Set(pay.methods.map((m) => PAY[m]).filter(Boolean))];
  const service = [
    { icon: "truck", title: de ? "Lieferung in 2–3 Tagen" : "Delivery in 2–3 days", text: perks.freeFrom ? (de ? `ab ${money(perks.freeFrom)} versandkostenfrei` : `free from ${money(perks.freeFrom)}`) : de ? "deutschlandweit" : "across Germany" },
    { icon: "bag", title: de ? "Kostenlos abholen" : "Free pickup", text: de ? "in Kaiserslautern" : "in Kaiserslautern" },
    { icon: "snow", title: de ? "Tiefkühl-Express" : "Frozen express", text: de ? "im Isolierkarton" : "in an insulated box" },
    { icon: "whatsapp", title: de ? "Fragen? WhatsApp" : "Questions? WhatsApp", text: de ? "wir antworten schnell" : "we reply fast" },
  ];
  const name = site.name || "Greenland Afro Asia Store";
  const social = [["instagram", site.instagram], ["facebook", site.facebook], ["tiktok", site.tiktok]].filter(([, v]) => v) as [string, string][];
  const col = "text-[0.8125rem] text-white/70";
  return (
    <footer className="mt-28 bg-forest text-white">
      <div className="border-b border-white/10">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-8 lg:grid-cols-4">
          {service.map((x) => (
            <li key={x.title} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-saffron"><Icon name={x.icon} size={19} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{x.title}</span>
                <span className="block text-xs text-white/65">{x.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          {site.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logo} alt={name} className="h-20 w-auto rounded-xl bg-white p-2" loading="lazy" />
          ) : (
            <span className="display text-lg font-semibold">{name}</span>
          )}
          {tx(site.about, lang) && <p className={`mt-2 ${col} leading-relaxed`}>{tx(site.about, lang)}</p>}
          {site.whatsapp && (
            <a href={`https://wa.me/${site.whatsapp}`} rel="noopener" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-[0.8125rem] font-semibold text-white hover:brightness-110">
              <Icon name="whatsapp" size={16} /> {ui("writeUs", lang)}
            </a>
          )}
          {social.length > 0 && (
            <div className="mt-4 flex gap-1">
              {social.map(([k, v]) => (
                <a key={k} href={v} aria-label={k} rel="noopener" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><Icon name={k} size={17} /></a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-saffron">{ui("shop", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            <li><Link href="/shop" className="hover:text-white">{ui("shopAll", lang)}</Link></li>
            {tree.map((d) => <li key={d.id}><Link href={`/c/${d.slug}`} className="hover:text-white">{lang === "de" ? d.title_de || d.title : d.title}</Link></li>)}
            <li><Link href="/laender" className="hover:text-white">{ui("countries", lang)}</Link></li>
            <li><Link href="/rezepte" className="hover:text-white">{ui("recipes", lang)}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-saffron">{ui("help", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {pages.map((p) => <li key={p.slug}><Link href={`/info/${p.slug}`} className="hover:text-white">{tx(p.title, lang)}</Link></li>)}
            {site.phone && <li>{site.phone}</li>}
            {site.email && <li><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-saffron">{ui("legal", lang)}</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {LEGAL.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white">{tx(l.label, lang)}</Link></li>)}
          </ul>
          {tx(site.address, lang) && <p className={`mt-5 whitespace-pre-line ${col}`}>{tx(site.address, lang)}</p>}
          {tx(site.hours, lang) && <p className={`mt-2 whitespace-pre-line ${col}`}>{tx(site.hours, lang)}</p>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.6875rem] text-white/60">{ui("vatNote", lang)} © {new Date().getFullYear()} {name}</p>
          {payments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={de ? "Zahlungsarten" : "Payment methods"}>
              {payments.map((m) => <li key={m} className="rounded-md bg-white px-2 py-1 text-[0.6875rem] font-semibold text-ink">{m}</li>)}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
