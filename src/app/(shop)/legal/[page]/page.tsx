import { notFound } from "next/navigation";
import { getPage } from "@/lib/content";
import { getLang, tx } from "@/lib/i18n";
import { Markdown } from "@/components/markdown";
import { supabaseAdmin } from "@/lib/supabase";
import { describeLocalTimes, getFrozenInfo, getLocalTimes } from "@/lib/commerce";
import { esc } from "@/lib/site";

export const dynamic = "force-dynamic";

// Templates only – have them checked (e.g. Händlerbund, IT-Recht Kanzlei, or a lawyer) and fill in [brackets].
const PAGES: Record<string, { title: string; body: string }> = {
  impressum: {
    title: "Impressum",
    body: `
<p><b>{{name}}</b><br>Inhaberin: {{owner}}<br>{{street}}<br>{{postal}} {{city}}<br>Deutschland</p>
<p>Telefon / WhatsApp: {{phone}}<br>E-Mail: {{email}}</p>
<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {{vat_id}}<br>Steuernummer: {{tax_number}}</p>
<p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: {{owner}}, Anschrift wie oben</p>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`,
  },
  versand: {
    title: "Delivery & pickup / Versand",
    body: `
<h3>Versand in Deutschland</h3><p>DHL, 2–3 Werktage, 5,99 €. Ab 69 € Bestellwert kostenlos.</p>
<h3>Tiefkühlware</h3><p>{{frozen}}</p>
<h3>Lieferung vor Ort</h3><p>Wir liefern selbst im Umkreis von 5 km (Luftlinie, wird aus Ihrer Adresse berechnet): {{local_times}}. Bestellungen bis {{cutoff}} Minuten vor Beginn werden am selben Tag geliefert, spätere am nächsten Liefertag. 3,99 €, ab 69 € kostenlos. Zahlung online oder bar/mit Karte bei Lieferung.</p>
<h3>Abholung</h3><p>Online bestellen und im Laden abholen ({{street}}, {{postal}} {{city}}) – immer kostenlos. Wir melden uns per WhatsApp, sobald Ihre Bestellung bereitliegt.</p>
<h3>Alkohol</h3><p>Bier und Palmwein geben wir nur an Personen ab 18 Jahren ab. Bitte halten Sie einen Ausweis bereit.</p>`,
  },
  widerruf: {
    title: "Widerrufsbelehrung",
    body: `
<p>Verbraucher haben ein vierzehntägiges Widerrufsrecht.</p>
<h3>Widerrufsrecht</h3><p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.</p>
<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({{name}}, {{owner}}, {{street}}, {{postal}} {{city}}, Telefon {{phone}}, E-Mail {{email}}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>
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
<h3>Verantwortlicher</h3><p>{{name}}, Inhaberin {{owner}}, {{street}}, {{postal}} {{city}}, E-Mail {{email}}.</p>
<h3>Bestellungen</h3><p>Zur Abwicklung Ihrer Bestellung verarbeiten wir Name, Anschrift, E-Mail, Telefonnummer und Bestelldaten (Art. 6 Abs. 1 lit. b DSGVO). Daten werden bei Supabase (Frankfurt, EU) gespeichert; die Website läuft bei Cloudflare.</p>
<h3>Videos von YouTube und Instagram</h3><p>Binden wir ein Video von YouTube (Google Ireland Limited) oder Instagram (Meta Platforms Ireland Limited) ein, wird es erst geladen, wenn Sie auf „abspielen“ tippen. Erst dann wird Ihre IP-Adresse an den jeweiligen Anbieter übertragen; YouTube-Videos nutzen dabei den erweiterten Datenschutzmodus (youtube-nocookie.com). Rechtsgrundlage ist Ihre Einwilligung durch den Klick (Art. 6 Abs. 1 lit. a DSGVO). Eigene Videos liegen auf unseren Servern und übertragen keine Daten an Dritte.</p>
<h3>Entfernung für die Lieferung vor Ort</h3><p>Wenn Sie die Lieferung vor Ort wählen möchten, senden wir Straße, Postleitzahl und Ort an den Adressdienst von OpenStreetMap (Nominatim), um die Entfernung zu unserem Laden zu berechnen (Art. 6 Abs. 1 lit. b DSGVO). Name, E-Mail oder Telefonnummer werden dabei nicht übermittelt.</p>
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
        <h1 className="h-section">{tx(cms.title, lang)}</h1>
        <Markdown text={tx(cms.body, lang)} className="mt-8" />
      </article>
    );
  const p = PAGES[page];
  if (!p) notFound();
  // business details from Admin → Account & receipts (missing ones stay visible as [brackets])
  const [{ data: st }, lt, fz] = await Promise.all([
    supabaseAdmin().from("settings").select("key, value").in("key", ["public.store", "public.receipt"]),
    getLocalTimes(),
    getFrozenInfo(),
  ]);
  const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const near = fz.local?.radius ? ` oder per eigener Lieferung im Umkreis von ${fz.local.radius} km um unseren Laden` : "";
  const frozenText =
    fz.courier != null
      ? `Tiefkühlware versenden wir deutschlandweit in einer isolierten Styroporbox mit Trockeneis per DHL Express, damit die Kühlkette nicht unterbrochen wird – in der Regel innerhalb von 24 Stunden bei Ihnen. Versandpauschale ${eur(fz.courier)}${fz.courierMin > 0 ? `, Mindestbestellwert ${eur(fz.courierMin)}` : ""}. Enthält Ihre Bestellung Tiefkühlware, wird die gesamte Bestellung so versendet. Alternativ: kostenlose Abholung im Laden${near}.`
      : `Damit die Kühlkette sicher bleibt, gibt es Tiefkühlware nur zur Abholung im Laden${near}. Kein Paketversand.`;
  const v = Object.assign({}, ...(st ?? []).map((r) => r.value as Record<string, string>)) as Record<string, string>;
  const phone = (v.phone ?? "").replace(/^0(\d{3})(\d+)$/, "0$1 $2");
  const fill: Record<string, string> = {
    name: v.name || "Greenland Afro Asia Store",
    owner: v.owner || "[Inhaber/in]",
    street: v.street || "[Straße]",
    postal: v.postal || "[PLZ]",
    city: v.city || "[Ort]",
    phone: phone || "[Telefon]",
    email: v.email || "[E-Mail]",
    vat_id: v.vat_id || "[DE…]",
    tax_number: v.tax_number || "[Steuernummer]",
    local_times: describeLocalTimes(lt, "de"),
    cutoff: String(lt.cutoffMin),
    frozen: frozenText,
  };
  const body = p.body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => esc(fill[k] ?? ""));
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12">
      <h1 className="h-section">{p.title}</h1>
      <div
        className="mt-8 space-y-4 text-[0.98rem] leading-relaxed [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </article>
  );
}
