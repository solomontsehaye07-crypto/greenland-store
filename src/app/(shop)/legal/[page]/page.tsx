import { notFound } from "next/navigation";
import { getPage } from "@/lib/content";
import { getLang, tx } from "@/lib/i18n";
import { Markdown } from "@/components/markdown";

export const dynamic = "force-dynamic";

// Templates only – have them checked (e.g. Händlerbund, IT-Recht Kanzlei, or a lawyer) and fill in [brackets].
const PAGES: Record<string, { title: string; body: string }> = {
  impressum: {
    title: "Impressum",
    body: `
<p><b>Greenland Afro Asia Store</b><br>[Inhaber/in: Vor- und Nachname]<br>[Straße] 58A<br>67657 Kaiserslautern<br>Deutschland</p>
<p>Telefon / WhatsApp: 0152 13945662<br>E-Mail: [kontakt@ihre-domain.de]</p>
<p>Umsatzsteuer-ID gemäß § 27a UStG: [DE…]</p>
<p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: [Name, Anschrift wie oben]</p>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`,
  },
  versand: {
    title: "Delivery & pickup / Versand",
    body: `
<h3>Standard delivery (Germany)</h3><p>DHL, 2–3 working days, 5.99 €. Free from 69 € order value.</p>
<h3>EU delivery</h3><p>Austria, Netherlands, Belgium, Luxembourg, France: 4–6 working days, 14.99 €, free from 149 €.</p>
<h3>Frozen express</h3><p>Frozen products are shipped Monday–Wednesday in an insulated box with cooling packs for next-working-day delivery. 19.99 €, minimum order 50 €. Please make sure someone is home.</p>
<h3>Local delivery</h3><p>Kaiserslautern and surroundings (postcodes 666xx, 667xx, 676xx), same or next day, 3.99 €, free from 40 €. Pay online or cash/card on delivery.</p>
<h3>Pickup</h3><p>Order online and collect at our shop in Kaiserslautern – always free. We message you on WhatsApp when your order is ready.</p>
<h3>Alcohol</h3><p>Beer and palm wine are only handed to persons aged 18 or older. Please have ID ready.</p>`,
  },
  widerruf: {
    title: "Widerrufsbelehrung",
    body: `
<p>Verbraucher haben ein vierzehntägiges Widerrufsrecht.</p>
<h3>Widerrufsrecht</h3><p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.</p>
<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Greenland Afro Asia Store, [Straße] 58A, 67657 Kaiserslautern, Telefon 0152 13945662, E-Mail [kontakt@ihre-domain.de]) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>
<h3>Folgen des Widerrufs</h3><p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.</p>
<h3>Ausschluss des Widerrufsrechts</h3><p>Das Widerrufsrecht besteht nicht bei Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde (z. B. Frisch- und Tiefkühlware), sowie bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (z. B. geöffnete Kosmetik).</p>`,
  },
  agb: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    body: `
<p>[Vorlage – bitte durch einen Rechtsdienst prüfen lassen.]</p>
<h3>§ 1 Geltungsbereich</h3><p>Diese AGB gelten für alle Bestellungen über den Online-Shop von Greenland Afro Asia Store, Kaiserslautern.</p>
<h3>§ 2 Vertragsschluss</h3><p>Die Darstellung der Produkte stellt kein rechtlich bindendes Angebot dar. Mit dem Klick auf „Bestellen und bezahlen“ geben Sie eine verbindliche Bestellung ab. Der Vertrag kommt mit unserer Bestellbestätigung per E-Mail zustande.</p>
<h3>§ 3 Preise und Versand</h3><p>Alle Preise enthalten die gesetzliche Mehrwertsteuer (7 % für Lebensmittel, 19 % für sonstige Waren) zzgl. Versandkosten gemäß unserer Versandseite.</p>
<h3>§ 4 Zahlung</h3><p>Wir akzeptieren die im Checkout angezeigten Zahlungsarten (z. B. Karte, PayPal, Klarna, Viva Wallet, Barzahlung bei Abholung/Lieferung).</p>
<h3>§ 5 Eigentumsvorbehalt</h3><p>Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.</p>
<h3>§ 6 Jugendschutz</h3><p>Alkoholische Getränke werden nur an Personen ab 18 Jahren abgegeben.</p>
<h3>§ 7 Gewährleistung</h3><p>Es gelten die gesetzlichen Gewährleistungsrechte.</p>`,
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    body: `
<p>[Vorlage – bitte mit einem Datenschutz-Generator (z. B. e-recht24) vervollständigen.]</p>
<h3>Verantwortlicher</h3><p>Greenland Afro Asia Store, [Inhaber/in], [Straße] 58A, 67657 Kaiserslautern, [E-Mail].</p>
<h3>Bestellungen</h3><p>Zur Abwicklung Ihrer Bestellung verarbeiten wir Name, Anschrift, E-Mail, Telefonnummer und Bestelldaten (Art. 6 Abs. 1 lit. b DSGVO). Daten werden bei Supabase (Frankfurt, EU) gespeichert; das Hosting erfolgt über Vercel.</p>
<h3>Zahlungsdienstleister</h3><p>Bei Zahlung über Stripe, PayPal oder Viva Wallet werden die zur Zahlung nötigen Daten an den jeweiligen Anbieter übermittelt.</p>
<h3>E-Mail</h3><p>Bestellbestätigungen versenden wir über Resend.</p>
<h3>Ihre Rechte</h3><p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde.</p>
<h3>Cookies</h3><p>Wir verwenden nur technisch notwendige Speicher (Warenkorb, Login). Es findet kein Tracking statt.</p>`,
  },
};

export default async function LegalPage({ params }: { params: Promise<{ page: string }> }) {
  const [{ page }, lang] = await Promise.all([params, getLang()]);
  // A page written in the website editor (same slug) replaces the built-in template.
  const cms = await getPage(page);
  if (cms)
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="display text-4xl font-extrabold">{tx(cms.title, lang)}</h1>
        <Markdown text={tx(cms.body, lang)} className="mt-8" />
      </article>
    );
  const p = PAGES[page];
  if (!p) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12">
      <h1 className="text-4xl font-extrabold">{p.title}</h1>
      <div
        className="mt-8 space-y-4 text-[0.98rem] leading-relaxed [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold"
        dangerouslySetInnerHTML={{ __html: p.body }}
      />
    </article>
  );
}
