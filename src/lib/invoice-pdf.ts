import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { GREEN, INK, MUTED, safe } from "./po-pdf";

// Invoices for business customers, delivery notes and payment reminders (German, § 14 UStG fields).
// Plain pdf-lib without server code: built on the phone/computer from the data the server sends.

export type DocKind = "invoice" | "delivery" | "reminder";

export interface InvoiceLine {
  title: string;
  sku?: string | null;
  size?: string | null;
  qty: number;
  unit_net: number;
  tax_rate: number;
}

export interface InvoiceDocInput {
  number: string | null; // null = draft
  status: "draft" | "open" | "paid" | "cancelled";
  issueDate: string | null; // yyyy-mm-dd
  deliveryDate: string | null;
  dueDate: string | null;
  paymentDays: number;
  store: { name: string; owner?: string; street?: string; postal?: string; city?: string; phone?: string; email?: string; vat_id?: string; tax_number?: string };
  customer: { name?: string; contact_name?: string | null; street?: string | null; postal?: string | null; city?: string | null; country?: string | null; vat_id?: string | null };
  items: InvoiceLine[];
  notes?: string | null;
  footer?: string | null;
  bank?: { holder?: string; iban?: string; bic?: string; bankName?: string } | null;
  paidAmount?: number | null;
  reminderNo?: number; // 1, 2 … for the reminder text
  logoB64?: string | null;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net, VAT and gross per tax rate and in total (VAT is calculated per rate, as required). */
export function invoiceTotals(items: InvoiceLine[]) {
  const byRate = new Map<number, number>();
  for (const i of items) byRate.set(Number(i.tax_rate), (byRate.get(Number(i.tax_rate)) ?? 0) + round2(Number(i.qty) * Number(i.unit_net)));
  const rates = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, net]) => ({ rate, net: round2(net), vat: round2((net * rate) / 100) }));
  const net = round2(rates.reduce((t, r) => t + r.net, 0));
  const vat = round2(rates.reduce((t, r) => t + r.vat, 0));
  return { rates, net, vat, gross: round2(net + vat) };
}

const eur = (n: number) => `${round2(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")} EUR`;
const de = (d: string | null | undefined) => (d ? d.split("-").reverse().join(".") : "-");
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const qtyText = (q: number) => (Number.isInteger(Number(q)) ? String(q) : String(q).replace(".", ","));

export async function buildInvoicePdf(inv: InvoiceDocInput, kind: DocKind = "invoice"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const right = W - M;
  let page = doc.addPage([W, H]);
  let y = H - 50;
  const today = new Date().toISOString().slice(0, 10);

  const text = (s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = INK) => page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const textR = (s: string, xr: number, yy: number, size = 10, f: PDFFont = font, color = INK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);
  const wrap = (str: string, w: number, size: number, f: PDFFont = font, maxLines = 2) => {
    const fits = (t: string) => f.widthOfTextAtSize(t, size) <= w;
    const words = safe(str)
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((wd) => {
        if (fits(wd)) return [wd];
        const out: string[] = [];
        let part = "";
        for (const ch of wd) {
          if (!fits(part + ch) && part) {
            out.push(part);
            part = ch;
          } else part += ch;
        }
        return part ? [...out, part] : out;
      });
    const lines: string[] = [];
    let cur = "";
    for (const w2 of words) {
      const next = cur ? `${cur} ${w2}` : w2;
      if (fits(next)) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w2;
      }
    }
    if (cur) lines.push(cur);
    const out = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let last = out[maxLines - 1];
      while (!fits(`${last}...`) && last.length > 1) last = last.slice(0, -1);
      out[maxLines - 1] = `${last.trimEnd()}...`;
    }
    return out;
  };

  const s = inv.store;
  const c = inv.customer;
  const title =
    kind === "delivery" ? "Lieferschein" : kind === "reminder" ? (inv.reminderNo && inv.reminderNo > 1 ? `${inv.reminderNo}. Zahlungserinnerung` : "Zahlungserinnerung") : inv.status === "cancelled" ? "Rechnung (storniert)" : inv.number ? "Rechnung" : "Rechnung - ENTWURF";

  // --- logo / seller
  let logoH = 0;
  if (inv.logoB64) {
    try {
      const img = await doc.embedPng(Uint8Array.from(atob(inv.logoB64), (ch) => ch.charCodeAt(0)));
      const h = 46;
      const w = (img.width / img.height) * h;
      page.drawImage(img, { x: M, y: y - h + 10, width: Math.min(w, 170), height: h });
      logoH = h;
    } catch {
      /* no logo */
    }
  }
  if (!logoH) text(s.name, M, y - 8, 15, bold, GREEN);
  const seller = [s.name, s.owner ? `Inh. ${s.owner}` : "", s.street ?? "", [s.postal, s.city].filter(Boolean).join(" "), s.phone ? `Tel. ${s.phone}` : "", s.email ?? ""].filter(Boolean);
  seller.forEach((l, i) => textR(l, right, y - i * 11, i === 0 ? 9.5 : 8.5, i === 0 ? bold : font, i === 0 ? INK : MUTED));
  y -= Math.max(66, seller.length * 11 + 14);

  // --- sender line + recipient
  text([s.name, s.street, [s.postal, s.city].filter(Boolean).join(" ")].filter(Boolean).join(" · "), M, y, 7, font, MUTED);
  y -= 16;
  const rec = [c.name ?? "", c.contact_name ? `z. Hd. ${c.contact_name}` : "", c.street ?? "", [c.postal, c.city].filter(Boolean).join(" "), c.country && c.country !== "DE" ? c.country : "", c.vat_id ? `USt-IdNr.: ${c.vat_id}` : ""].filter(Boolean);
  const recTop = y;
  rec.forEach((l, i) => text(l, M, recTop - i * 13, 10.5, i === 0 ? bold : font));

  // --- document data (right)
  const meta: [string, string][] =
    kind === "reminder"
      ? [
          ["Rechnung Nr.", inv.number ?? "-"],
          ["Rechnungsdatum", de(inv.issueDate)],
          ["Fällig seit", de(inv.dueDate)],
          ["Datum", de(today)],
        ]
      : [
          [kind === "delivery" ? "Zu Rechnung Nr." : "Rechnung Nr.", inv.number ?? "Entwurf"],
          ["Rechnungsdatum", de(inv.issueDate ?? today)],
          ["Liefer-/Leistungsdatum", de(inv.deliveryDate ?? inv.issueDate ?? today)],
          ...(kind === "invoice" ? ([["Zahlbar bis", de(inv.dueDate ?? addDays(inv.issueDate ?? today, inv.paymentDays))]] as [string, string][]) : []),
        ];
  meta.forEach(([k, v], i) => {
    text(k, right - 220, recTop - i * 13, 9, font, MUTED);
    textR(v, right, recTop - i * 13, 9.5, bold);
  });
  y = recTop - Math.max(rec.length, meta.length) * 13 - 26;

  text(title, M, y, 17, bold, kind === "invoice" && inv.status === "cancelled" ? rgb(0.7, 0.2, 0.15) : INK);
  y -= 22;

  const totals = invoiceTotals(inv.items);

  // --- reminder: letter instead of a table
  if (kind === "reminder") {
    const open = round2(totals.gross - Number(inv.paidAmount ?? 0));
    const newDue = de(addDays(today, 7));
    const body = [
      "Sehr geehrte Damen und Herren,",
      "",
      `sicher ist es nur ein Versehen: Für unsere Rechnung ${inv.number} vom ${de(inv.issueDate)} konnten wir bis heute keinen Zahlungseingang feststellen. Die Zahlung war am ${de(inv.dueDate)} fällig.`,
      "",
      `Wir bitten Sie, den offenen Betrag von ${eur(open)} bis zum ${newDue} auf das unten genannte Konto zu überweisen. Bitte geben Sie als Verwendungszweck die Rechnungsnummer ${inv.number} an.`,
      "",
      "Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.",
      "",
      "Mit freundlichen Grüßen",
      s.owner || s.name,
    ];
    for (const para of body) {
      if (!para) {
        y -= 8;
        continue;
      }
      for (const l of wrap(para, right - M, 10.5, font, 6)) {
        text(l, M, y, 10.5);
        y -= 15;
      }
    }
    y -= 10;
    page.drawRectangle({ x: M - 6, y: y - 46, width: right - M + 12, height: 58, color: rgb(0.95, 0.97, 0.95) });
    text("Rechnungsbetrag", M, y - 4, 10);
    textR(eur(totals.gross), right, y - 4, 10);
    if (inv.paidAmount) {
      text("bereits bezahlt", M, y - 18, 10);
      textR(`- ${eur(Number(inv.paidAmount))}`, right, y - 18, 10);
    }
    text("Offener Betrag", M, y - 34, 11.5, bold);
    textR(eur(open), right, y - 34, 11.5, bold);
    y -= 70;
  } else {
    // --- table
    const priced = kind === "invoice";
    type Col = { key: string; label: string; w: number; align?: "right" };
    const cols: Col[] = [
      { key: "pos", label: "Pos.", w: 26 },
      { key: "title", label: "Artikel", w: 0 },
      { key: "size", label: "Größe", w: 52 },
      { key: "qty", label: "Menge", w: 40, align: "right" },
      ...(priced
        ? ([
            { key: "unit", label: "Einzelpreis", w: 66, align: "right" },
            { key: "vat", label: "USt.", w: 30, align: "right" },
            { key: "sum", label: "Gesamt netto", w: 72, align: "right" },
          ] as Col[])
        : ([{ key: "check", label: "Erhalten", w: 50, align: "right" }] as Col[])),
    ];
    const GAP = 7;
    const fixed = cols.reduce((t, c2) => t + c2.w, 0) + GAP * (cols.length - 1);
    cols[1].w = right - M - fixed;
    const xs: number[] = [];
    cols.reduce((x, c2) => (xs.push(x), x + c2.w + GAP), M);
    const put = (i: number, str: string, yy: number, size: number, f: PDFFont = font, color = INK) => {
      const c2 = cols[i];
      const x = c2.align === "right" ? xs[i] + c2.w - f.widthOfTextAtSize(safe(str), size) : xs[i];
      text(str, x, yy, size, f, color);
    };
    const header = () => {
      page.drawRectangle({ x: M - 6, y: y - 6, width: right - M + 12, height: 20, color: rgb(0.89, 0.93, 0.9) });
      cols.forEach((_, i) => put(i, cols[i].label, y, 8.5, bold));
      y -= 22;
    };
    header();
    inv.items.forEach((it, n) => {
      const titleLines = wrap(it.title, cols[1].w, 9, font, 2);
      const sku = it.sku ? wrap(`Art.-Nr. ${it.sku}`, cols[1].w, 7.5, font, 1) : [];
      const sizeLines = wrap(it.size ?? "", 52, 9, font, 2);
      const lines = Math.max(titleLines.length + sku.length, sizeLines.length, 1);
      const h = 11 * lines + 7;
      if (y - h < 150) {
        page = doc.addPage([W, H]);
        y = H - 60;
        header();
      }
      put(0, String(n + 1), y, 9, font, MUTED);
      titleLines.forEach((l, k) => text(l, xs[1], y - 11 * k, 9));
      sku.forEach((l) => text(l, xs[1], y - 11 * titleLines.length, 7.5, font, MUTED));
      sizeLines.forEach((l, k) => put(2, l, y - 11 * k, 9));
      put(3, qtyText(it.qty), y, 9.5, bold);
      if (priced) {
        put(4, eur(Number(it.unit_net)), y, 9);
        put(5, `${Number(it.tax_rate)} %`, y, 9);
        put(6, eur(Number(it.qty) * Number(it.unit_net)), y, 9);
      } else {
        page.drawRectangle({ x: xs[4] + cols[4].w - 11, y: y - 2, width: 10, height: 10, borderColor: MUTED, borderWidth: 0.8 });
      }
      y -= h;
      page.drawLine({ start: { x: M - 6, y: y + 9 }, end: { x: right + 6, y: y + 9 }, thickness: 0.4, color: rgb(0.85, 0.87, 0.85) });
    });

    y -= 8;
    if (priced) {
      const row = (label: string, val: string, f: PDFFont = font, size = 9.5) => {
        text(label, right - 250, y, size, f);
        textR(val, right, y, size, f);
        y -= 14;
      };
      row("Summe netto", eur(totals.net));
      for (const r of totals.rates) row(`zzgl. ${r.rate} % USt. auf ${eur(r.net)}`, eur(r.vat));
      page.drawLine({ start: { x: right - 250, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.8, color: INK });
      y -= 2;
      row("Rechnungsbetrag", eur(totals.gross), bold, 11.5);
      y -= 8;
      if (inv.status === "paid") {
        text("Betrag dankend erhalten.", M, y, 10, bold, GREEN);
        y -= 16;
      } else if (inv.status !== "cancelled") {
        const due = de(inv.dueDate ?? addDays(inv.issueDate ?? today, inv.paymentDays));
        for (const l of wrap(`Bitte überweisen Sie den Rechnungsbetrag ohne Abzug bis zum ${due} auf das unten genannte Konto. Verwendungszweck: ${inv.number ?? "Rechnungsnummer"}.`, right - M, 9.5, font, 3)) {
          text(l, M, y, 9.5);
          y -= 13;
        }
      }
    } else {
      const units = inv.items.reduce((t, i) => t + Number(i.qty), 0);
      text(`${inv.items.length} Artikel, ${qtyText(units)} Einheiten`, M, y, 10, bold);
      y -= 46;
      page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.6, color: INK });
      page.drawLine({ start: { x: right - 200, y }, end: { x: right, y }, thickness: 0.6, color: INK });
      text("Datum, Unterschrift Fahrer", M, y - 12, 8, font, MUTED);
      text("Ware vollständig erhalten (Datum, Unterschrift)", right - 200, y - 12, 8, font, MUTED);
      y -= 24;
    }
  }

  if (inv.notes && kind !== "reminder") {
    y -= 6;
    for (const l of inv.notes.split("\n").flatMap((p) => wrap(p, right - M, 9.5, font, 4)).slice(0, 8)) {
      text(l, M, y, 9.5);
      y -= 13;
    }
  }

  // --- footer on every page: seller, tax ids, bank
  const b = inv.bank ?? {};
  const legal = [
    [s.name, s.owner ? `Inh. ${s.owner}` : "", [s.street, [s.postal, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    [s.tax_number ? `Steuernummer: ${s.tax_number}` : "", s.vat_id ? `USt-IdNr.: ${s.vat_id}` : ""].filter(Boolean).join(" · "),
    kind !== "delivery" && b.iban ? [`Bank: ${b.bankName ?? ""}`.trim(), b.holder ? `Kontoinhaber: ${b.holder}` : "", `IBAN: ${b.iban}`, b.bic ? `BIC: ${b.bic}` : ""].filter((x) => x && x !== "Bank:").join(" · ") : "",
    inv.footer ?? "",
  ].filter(Boolean);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    let fy = 34 + legal.length * 10;
    p.drawLine({ start: { x: M, y: fy + 8 }, end: { x: right, y: fy + 8 }, thickness: 0.4, color: rgb(0.8, 0.83, 0.8) });
    for (const l of legal) {
      for (const w2 of wrap(l, right - M - 60, 7.5, font, 1)) p.drawText(w2, { x: M, y: fy, size: 7.5, font, color: MUTED });
      fy -= 10;
    }
    if (pages.length > 1) {
      const t = `Seite ${i + 1} von ${pages.length}`;
      p.drawText(t, { x: right - font.widthOfTextAtSize(t, 7.5), y: 24, size: 7.5, font, color: MUTED });
    }
  });
  return doc.save();
}
