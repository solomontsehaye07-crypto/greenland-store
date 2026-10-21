import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Report } from "./reports";
import { REASON_DE } from "./reports";

import { GREEN, INK, MUTED, safe } from "./po-pdf";
export { buildPurchaseOrderPdf, type PoPdfInput } from "./po-pdf";

// ---------------- customer receipt / invoice ----------------

export interface ReceiptInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: Record<string, any>;
  store: Record<string, string>; // name, owner, street, postal, city, phone, email, vat_id
  receipt: Record<string, string>; // tax_number, footer, title
  bank?: { holder?: string; iban?: string; bic?: string; bankName?: string };
}

const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} EUR`;

export async function buildReceiptPdf({ order: o, store, receipt, bank }: ReceiptInput): Promise<Uint8Array> {
  // Layout follows § 14 UStG: seller with tax number, customer, consecutive number, invoice and delivery date,
  // items with quantity, net amount and VAT per rate, gross total.
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  const M = 48;
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) => page.drawText(safe(String(s ?? "")), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, color = INK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);
  const de = (d: string | Date) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const name = store.name || "Greenland Afro Asia Store";

  // --- header: logo left, document data right
  let y = 800;
  try {
    const { LOGO_PRINT_PNG_B64 } = await import("./logo-print");
    const img = await doc.embedPng(Uint8Array.from(atob(LOGO_PRINT_PNG_B64), (c) => c.charCodeAt(0)));
    const h = 46;
    page.drawImage(img, { x: M, y: y - h + 10, width: (img.width / img.height) * h, height: h });
  } catch {
    text(name, M, y - 10, 16, bold, GREEN);
  }
  right(receipt.title || "Rechnung", width - M, y, 16, bold, GREEN);
  y -= 18;
  const meta: [string, string][] = [
    ["Rechnungsnr.", String(o.receipt_number ?? o.number)],
    ["Rechnungsdatum", de(o.paid_at ?? o.created_at)],
    ["Lieferdatum", o.pickup_at ? de(o.pickup_at) : de(o.paid_at ?? o.created_at)],
    ["Bestellung", `#${o.number}`],
  ];
  for (const [l, v] of meta) {
    right(v, width - M, y, 9.5, bold);
    right(l, width - M - 92, y, 9.5, font, MUTED);
    y -= 13;
  }

  // --- seller and customer
  y -= 14;
  const seller = [
    name,
    store.owner ? `Inh. ${store.owner}` : "",
    store.street,
    [store.postal, store.city].filter(Boolean).join(" "),
    [store.phone && `Tel. ${store.phone}`, store.email].filter(Boolean).join(" · "),
    receipt.tax_number ? `Steuernummer: ${receipt.tax_number}` : "",
    store.vat_id ? `USt-IdNr.: ${store.vat_id}` : "",
  ].filter(Boolean);
  const a = (o.shipping_address ?? {}) as Record<string, string>;
  const buyer = [a.name, a.street, [a.postal, a.city].filter(Boolean).join(" "), a.country && a.country !== "DE" ? a.country : "", o.email].filter(Boolean);
  const top = y;
  text("Verkäufer", M, y, 8.5, bold, MUTED);
  y -= 13;
  seller.forEach((l, i) => {
    text(l, M, y, 9.5, i === 0 ? bold : font);
    y -= 12;
  });
  let yb = top;
  const bx = width / 2 + 20;
  text("Rechnung an", bx, yb, 8.5, bold, MUTED);
  yb -= 13;
  buyer.forEach((l, i) => {
    text(l, bx, yb, 9.5, i === 0 ? bold : font);
    yb -= 12;
  });
  y = Math.min(y, yb) - 18;

  // --- items
  const cols = { pos: M, title: M + 22, qty: width - M - 245, vat: width - M - 195, unit: width - M - 85, sum: width - M };
  const header = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: width - 2 * M + 12, height: 20, color: rgb(0.93, 0.95, 0.93) });
    text("Pos.", cols.pos, y, 8.5, bold);
    text("Artikel", cols.title, y, 8.5, bold);
    text("Menge", cols.qty, y, 8.5, bold);
    text("MwSt.", cols.vat, y, 8.5, bold);
    right("Einzelpreis", cols.unit, y, 8.5, bold);
    right("Gesamt", cols.sum, y, 8.5, bold);
    y -= 22;
  };
  header();
  const items = (o.order_items ?? []) as { title: string; qty: number; unit_price: number; tax_rate: number }[];
  const vat = new Map<number, number>(); // rate → gross
  const line = (pos: string, title: string, qty: string, rate: number, unit: number | null, sum: number) => {
    if (y < 190) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
      header();
    }
    const t = title.length > 50 ? title.slice(0, 49) + "…" : title;
    text(pos, cols.pos, y, 9);
    text(t, cols.title, y, 9);
    text(qty, cols.qty + 8, y, 9);
    text(`${rate} %`, cols.vat, y, 9);
    if (unit != null) right(eur(unit), cols.unit, y, 9);
    right(eur(sum), cols.sum, y, 9);
    y -= 15;
    page.drawLine({ start: { x: M - 6, y: y + 9 }, end: { x: width - M + 6, y: y + 9 }, thickness: 0.4, color: rgb(0.86, 0.87, 0.86) });
    vat.set(rate, (vat.get(rate) ?? 0) + sum);
  };
  items.forEach((it, i) => line(String(i + 1), it.title, String(it.qty), Number(it.tax_rate), Number(it.unit_price), Number(it.unit_price) * it.qty));

  // delivery and packaging follow the main VAT rate of the goods (same rule as the checkout)
  const sub = Number(o.subtotal);
  const g19 = items.filter((i) => Number(i.tax_rate) === 19).reduce((t, i) => t + Number(i.unit_price) * i.qty, 0);
  const shipRate = g19 > sub / 2 ? 19 : 7;
  const pack = Number(o.packaging_total) || 0;
  const ship = Number(o.shipping_total) - pack;
  let pos = items.length;
  if (ship > 0) line(String(++pos), (o.shipping_methods?.name as string) || "Versand", "1", shipRate, ship, ship);
  if (pack > 0) line(String(++pos), "Tiefkühl-Verpackung (Isolierbox, Kühlakkus)", String(o.frozen_boxes || 1), shipRate, pack / (Number(o.frozen_boxes) || 1), pack);

  // --- VAT breakdown per rate and totals
  y -= 8;
  const tx = width - M - 270;
  const head = () => {
    text("MwSt.-Satz", tx, y, 8.5, bold, MUTED);
    right("Netto", tx + 130, y, 8.5, bold, MUTED);
    right("MwSt.", tx + 200, y, 8.5, bold, MUTED);
    right("Brutto", width - M, y, 8.5, bold, MUTED);
    y -= 14;
  };
  head();
  let net = 0;
  let tax = 0;
  for (const [rate, gross] of [...vat.entries()].sort((x, z) => x[0] - z[0])) {
    const n = gross / (1 + rate / 100);
    net += n;
    tax += gross - n;
    text(`${rate} %`, tx, y, 9.5);
    right(eur(n), tx + 130, y, 9.5);
    right(eur(gross - n), tx + 200, y, 9.5);
    right(eur(gross), width - M, y, 9.5);
    y -= 13;
  }
  page.drawLine({ start: { x: tx, y: y + 6 }, end: { x: width - M, y: y + 6 }, thickness: 0.6, color: MUTED });
  y -= 6;
  text("Summe netto", tx, y, 9.5);
  right(eur(net), width - M, y, 9.5);
  y -= 13;
  text("Umsatzsteuer", tx, y, 9.5);
  right(eur(tax), width - M, y, 9.5);
  y -= 16;
  page.drawRectangle({ x: tx - 6, y: y - 6, width: width - M - tx + 12, height: 20, color: rgb(0.114, 0.361, 0.247) });
  text("Gesamtbetrag", tx, y, 11, bold, rgb(1, 1, 1));
  right(eur(Number(o.total)), width - M, y, 11, bold, rgb(1, 1, 1));
  y -= 30;

  // --- payment
  const paid: Record<string, string> = {
    stripe: "Bezahlt mit Karte (Stripe)",
    paypal: "Bezahlt mit PayPal",
    viva: "Bezahlt mit Viva Wallet",
    cash: "Zahlung bei Abholung / Lieferung",
    cash_deposit: "Anzahlung online bezahlt, Rest bei Abholung",
    bank: "Zahlung per Überweisung",
  };
  text("Zahlung", M, y, 8.5, bold, MUTED);
  y -= 13;
  text(paid[o.payment_method ?? o.payment_provider ?? ""] ?? String(o.payment_provider ?? ""), M, y, 9.5);
  y -= 13;
  if (o.deposit_amount) {
    text(`Anzahlung: ${eur(Number(o.deposit_amount))}   Offener Betrag: ${eur(Number(o.balance_due))}`, M, y, 9.5, bold);
    y -= 13;
  } else if (Number(o.balance_due) > 0) {
    text(`Offener Betrag: ${eur(Number(o.balance_due))}`, M, y, 9.5, bold);
    y -= 13;
  }
  if (o.payment_method === "bank" && !o.paid_at && bank?.iban) {
    text(`Bitte überweisen an ${bank.holder ?? ""}, IBAN ${bank.iban}${bank.bic ? `, BIC ${bank.bic}` : ""}, Verwendungszweck: Bestellung ${o.number}`, M, y, 9);
    y -= 13;
  }
  if (o.pickup_slot) {
    text(`Abholung: ${o.pickup_slot}`, M, y, 9.5);
    y -= 13;
  }

  // --- footer
  page.drawLine({ start: { x: M, y: 74 }, end: { x: width - M, y: 74 }, thickness: 0.4, color: rgb(0.86, 0.87, 0.86) });
  const footer = receipt.footer || `Vielen Dank für Ihren Einkauf bei ${name}!`;
  footer.split("\n").slice(0, 3).forEach((l, i) => text(l, M, 60 - i * 11, 8, font, MUTED));
  const legal = [name, store.owner && `Inh. ${store.owner}`, [store.street, [store.postal, store.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), receipt.tax_number && `St.-Nr. ${receipt.tax_number}`, store.vat_id && `USt-IdNr. ${store.vat_id}`].filter(Boolean).join(" · ");
  right(legal, width - M, 38, 7, font, MUTED);
  return doc.save();
}

// ---------------- bookkeeping report for the tax advisor ----------------


export async function buildReportPdf(r: Report, store: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 42;
  let page = doc.addPage([W, H]);
  let y = H - 50;
  const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const e = (x: number | null) => (x == null ? "–" : `${x.toFixed(2).replace(".", ",")} €`);
  const text = (s: string, x: number, yy: number, size = 9, f = font, color = INK) => page.drawText(safe(String(s ?? "")), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 9, f = font, color = INK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);
  const need = (h: number) => {
    if (y - h < 50) {
      page = doc.addPage([W, H]);
      y = H - 50;
    }
  };
  const h2 = (s: string) => {
    need(40);
    y -= 14;
    text(s, M, y, 12, bold, GREEN);
    y -= 16;
  };
  /** cols: [label, x, align] ; rows of strings */
  const table = (cols: [string, number, "l" | "r"][], rows: string[][], totals?: string[]) => {
    const head = () => {
      page.drawRectangle({ x: M - 4, y: y - 4, width: W - 2 * M + 8, height: 16, color: rgb(0.93, 0.95, 0.93) });
      cols.forEach(([l, x, a]) => (a === "r" ? right(l, x, y, 8, bold) : text(l, x, y, 8, bold)));
      y -= 16;
    };
    head();
    for (const row of rows) {
      if (y < 60) {
        page = doc.addPage([W, H]);
        y = H - 50;
        head();
      }
      row.forEach((v, i) => {
        const [, x, a] = cols[i];
        const maxW = i < cols.length - 1 ? (cols[i + 1][2] === "r" ? cols[i + 1][1] - 60 : cols[i + 1][1]) - x - 4 : 999;
        let s = String(v);
        while (a === "l" && s.length > 3 && font.widthOfTextAtSize(safe(s), 8) > maxW) s = s.slice(0, -2);
        if (s !== String(v) && a === "l") s = s.slice(0, -1) + "…";
        if (a === "r") right(s, x, y, 8);
        else text(s, x, y, 8);
      });
      y -= 12;
    }
    if (totals) {
      page.drawLine({ start: { x: M - 4, y: y + 8 }, end: { x: W - M + 4, y: y + 8 }, thickness: 0.6, color: rgb(0.7, 0.72, 0.7) });
      totals.forEach((v, i) => {
        if (!v) return;
        const [, x, a] = cols[i];
        if (a === "r") right(v, x, y - 2, 8, bold);
        else text(v, x, y - 2, 8, bold);
      });
      y -= 16;
    }
  };

  // cover / summary
  text(store.name || "Greenland Afro Asia Store", M, y, 15, bold, GREEN);
  right("Buchhaltungsbericht", W - M, y, 12, bold);
  y -= 15;
  text([store.street, [store.postal, store.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), M, y, 9, font, MUTED);
  right(`Zeitraum ${de(r.from)} – ${de(r.to)}`, W - M, y, 10);
  y -= 12;
  text([store.vat_id && `USt-IdNr. ${store.vat_id}`, store.tax_number && `St.-Nr. ${store.tax_number}`].filter(Boolean).join("   "), M, y, 9, font, MUTED);
  right(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, W - M, y, 9, font, MUTED);
  y -= 10;

  const T = r.salesTotal;
  h2("Übersicht");
  const sumRows: [string, string][] = [
    ["Umsatz brutto gesamt", e(T.gross)],
    ["   davon Onlineshop", e(T.online)],
    ["   davon Ladenkasse", e(T.store)],
    ["Umsatz netto 7 %  /  USt 7 %", `${e(T.net7)}  /  ${e(T.vat7)}`],
    ["Umsatz netto 19 %  /  USt 19 %", `${e(T.net19)}  /  ${e(T.vat19)}`],
    ["Wareneingang (EK netto)", e(r.purchasesTotal)],
    ...r.lossesByReason.map((l) => [`Warenverlust: ${REASON_DE[l.reason]} (${l.qty} Stk.)`, e(l.value)] as [string, string]),
    ["Eigenverbrauch / Entnahme (EK netto)", e(r.ownUseTotal)],
    ["Betriebsausgaben (erfasst)", e(r.expensesTotal)],
  ];
  for (const [l, v] of sumRows) {
    text(l, M, y, 9);
    right(v, W - M, y, 9, bold);
    y -= 13;
  }
  if (r.unvalued) {
    y -= 4;
    text(`Hinweis: ${r.unvalued} Verlust-/Entnahmepositionen ohne Einkaufspreis sind nicht bewertet.`, M, y, 8, font, MUTED);
    y -= 12;
  }

  h2("1. Umsätze nach Steuersatz");
  table(
    [["Datum", M, "l"], ["Beleg", M + 58, "l"], ["Zahlart", M + 110, "l"], ["Netto 7%", M + 250, "r"], ["USt 7%", M + 310, "r"], ["Netto 19%", M + 375, "r"], ["USt 19%", M + 435, "r"], ["Brutto", W - M, "r"]],
    r.sales.map((s) => [de(s.date), s.ref, s.payment, e(s.net7), e(s.vat7), e(s.net19), e(s.vat19), e(s.gross)]),
    ["Summe", "", "", e(T.net7), e(T.vat7), e(T.net19), e(T.vat19), e(T.gross)]
  );

  const stockTable = (rows: typeof r.losses, total: number) =>
    table(
      [["Datum", M, "l"], ["Art", M + 55, "l"], ["Artikel", M + 150, "l"], ["Menge", M + 370, "r"], ["EK/Stk.", M + 430, "r"], ["Wert", W - M, "r"]],
      rows.map((x) => [de(x.date), REASON_DE[x.reason] ?? x.reason, `${x.sku} ${x.title}`, String(x.qty), e(x.unitCost), e(x.value)]),
      ["Summe", "", "", String(rows.reduce((s, x) => s + x.qty, 0)), "", e(total)]
    );

  h2("2. Warenverluste (verdorben, beschädigt, abgelaufen, gestohlen)");
  if (r.losses.length) stockTable(r.losses, r.lossesByReason.reduce((s, x) => s + x.value, 0));
  else { text("Keine Einträge im Zeitraum.", M, y, 9, font, MUTED); y -= 14; }

  h2("3. Eigenverbrauch / Entnahmen");
  if (r.ownUse.length) stockTable(r.ownUse, r.ownUseTotal);
  else { text("Keine Einträge im Zeitraum.", M, y, 9, font, MUTED); y -= 14; }

  h2("4. Wareneingang");
  if (r.purchases.length) stockTable(r.purchases, r.purchasesTotal);
  else { text("Keine Einträge im Zeitraum.", M, y, 9, font, MUTED); y -= 14; }

  h2("5. Betriebsausgaben (im Shop erfasst)");
  if (r.expenses.length)
    table(
      [["Datum", M, "l"], ["Kategorie", M + 60, "l"], ["Notiz", M + 180, "l"], ["Betrag", W - M, "r"]],
      r.expenses.map((x) => [de(x.date), x.category, x.note, e(x.amount)]),
      ["Summe", "", "", e(r.expensesTotal)]
    );
  else { text("Keine Einträge im Zeitraum.", M, y, 9, font, MUTED); y -= 14; }

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(safe(`Seite ${i + 1} von ${pages.length} · ${store.name || "Greenland Afro Asia Store"} · ${de(r.from)} – ${de(r.to)}`), { x: M, y: 28, size: 7, font, color: MUTED }));
  return doc.save();
}
