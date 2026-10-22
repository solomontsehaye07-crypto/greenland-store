import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/content";
import { getLang, tx } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { NewsletterForm } from "@/components/sections/newsletter-form";

export const metadata: Metadata = { title: "Bald geöffnet · Opening soon", robots: { index: false } };

// Shown on greenland-afroasia.de while the shop is hidden (switch in Admin → Overview).
// The Worker (worker.ts) sends every shop page here until the shop goes live.
export default async function ComingSoon() {
  const [{ site }, lang] = await Promise.all([getSite(), getLang()]);
  const de = lang === "de";
  const name = site.name || "Greenland Afro Asia Store";
  const logo = site.logo || site.icon;
  return (
    <main className="relative flex min-h-[100svh] flex-col bg-forest text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="h-24 w-auto rounded-2xl bg-white p-3" />
        ) : (
          <span className="display text-2xl font-semibold">{name}</span>
        )}
        <p className="mt-10 text-sm font-semibold text-saffron">{de ? "Bald geöffnet" : "Opening soon"}</p>
        <h1 className="display mt-3 text-4xl font-semibold leading-[1.05] sm:text-6xl" style={{ textWrap: "balance" }}>
          {de ? "Unser neuer Online-Shop kommt in Kürze." : "Our new online shop is almost ready."}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80">
          {de
            ? "Afrikanische und asiatische Lebensmittel, Kosmetik und Deko – bald mit Lieferung in ganz Deutschland. Trag dich ein, und wir sagen dir Bescheid, sobald es losgeht."
            : "African and Asian food, cosmetics and décor – soon delivered all over Germany. Leave your email and we'll tell you the moment we open."}
        </p>
        <div className="mt-8 w-full max-w-md text-left text-ink">
          <NewsletterForm lang={lang} button={de ? "Benachrichtigen" : "Notify me"} placeholder={de ? "Deine E-Mail-Adresse" : "Your email address"} thanks={de ? "Danke! Wir melden uns zum Start." : "Thank you! We'll write when we open."} />
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          {site.whatsapp && (
            <a href={`https://wa.me/${site.whatsapp}`} rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-semibold text-white">
              <Icon name="whatsapp" size={18} /> {de ? "Fragen? Schreib uns" : "Questions? Message us"}
            </a>
          )}
        </div>
        {tx(site.address, lang) && (
          <p className="mt-8 whitespace-pre-line text-sm text-white/70">
            {de ? "Unser Laden ist geöffnet:" : "Our store is open:"}
            {"\n"}
            {tx(site.address, lang)}
            {tx(site.hours, lang) ? `\n${tx(site.hours, lang)}` : ""}
          </p>
        )}
      </div>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-6 pb-8 text-xs text-white/60">
        <Link href="/legal/impressum" className="hover:text-white">Impressum</Link>
        <Link href="/legal/datenschutz" className="hover:text-white">{de ? "Datenschutz" : "Privacy"}</Link>
        <span>© {new Date().getFullYear()} {name}</span>
      </footer>
    </main>
  );
}
