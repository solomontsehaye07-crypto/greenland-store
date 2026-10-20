import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Report } from "./reports";
import { REASON_DE } from "./reports";

export interface PoPdfInput {
  number: number;
  kind: "refill" | "dropship";
  date: string;
  expected?: string | null;
  store: { name: string; street: string; postal: string; city: string; phone: string; email?: string };
  supplier: { name: string; contact_name?: string | null; address?: string | null; email?: string | null; phone?: string | null };
  items: { sku: string; supplier_sku?: string | null; title: string; qty: number; unit_cost?: number | null; note?: string | null }[];
  showPrices?: boolean;
  shipTo?: { name: string; street: string; postal: string; city: string; country: string; phone?: string } | null;
  notes?: string | null;
}

const GREEN = rgb(0.114, 0.361, 0.247);
const INK = rgb(0.08, 0.13, 0.11);
const MUTED = rgb(0.42, 0.47, 0.44);

// WinAnsi can't encode every glyph – keep the PDF robust
const safe = (s: string) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/…/g, "...")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function buildPurchaseOrderPdf(po: PoPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const M = 48;
  let y = 790;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });

  text(po.store.name, M, y, 16, bold, GREEN);
  text(po.kind === "dropship" ? "DROPSHIP ORDER" : "PURCHASE ORDER / BESTELLUNG", width - M - 220, y, 11, bold);
  y -= 16;
  text(`${po.store.street}, ${po.store.postal} ${po.store.city}`, M, y, 9, font, MUTED);
  text(`No. PO-${po.number}`, width - M - 220, y, 10);
  y -= 12;
  text(`Tel. ${po.store.phone}${po.store.email ? "  " + po.store.email : ""}`, M, y, 9, font, MUTED);
  text(`Date: ${po.date}`, width - M - 220, y, 10);
  if (po.expected) {
    y -= 12;
    text(`Requested delivery: ${po.expected}`, width - M - 220, y, 10);
  }

  y -= 36;
  text("Supplier", M, y, 9, bold, MUTED);
  if (po.shipTo) text("Ship directly to customer", width / 2, y, 9, bold, MUTED);
  y -= 14;
  const supLines = [po.supplier.name, po.supplier.contact_name, po.supplier.address, po.supplier.email, po.supplier.phone].filter(
    Boolean
  ) as string[];
  const shipLines = po.shipTo
    ? [po.shipTo.name, po.shipTo.street, `${po.shipTo.postal} ${po.shipTo.city}`, po.shipTo.country, po.shipTo.phone ?? ""]
    : [];
  const rows = Math.max(supLines.length, shipLines.length);
  for (let i = 0; i < rows; i++) {
    if (supLines[i]) text(supLines[i], M, y, 10, i === 0 ? bold : font);
    if (shipLines[i]) text(shipLines[i], width / 2, y, 10, i === 0 ? bold : font);
    y -= 13;
  }

  // table
  y -= 18;
  const cols = [M, M + 80, M + 170, width - M - 150, width - M - 80];
  const header = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: width - 2 * M + 12, height: 20, color: rgb(0.89, 0.93, 0.9) });
    ["SKU", "Supplier ref", "Product", "Qty", po.showPrices === false ? "" : "Unit cost"].forEach((h, i) => text(h, cols[i], y, 9, bold));
    y -= 22;
  };
  header();
  let total = 0;
  for (const it of po.items) {
    if (y < 90) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
      header();
    }
    const title = it.title.length > 48 ? it.title.slice(0, 47) + "…" : it.title;
    text(it.sku, cols[0], y, 9);
    text(it.supplier_sku ?? "", cols[1], y, 9);
    text(title, cols[2], y, 9);
    text(String(it.qty), cols[3], y, 10, bold);
    if (it.unit_cost != null && po.showPrices !== false) {
      text(`${Number(it.unit_cost).toFixed(2)} EUR`, cols[4], y, 9);
      total += Number(it.unit_cost) * it.qty;
    }
    if (it.note) {
      y -= 11;
      text(it.note.slice(0, 80), cols[2], y, 8, font, MUTED);
    }
    y -= 16;
    page.drawLine({ start: { x: M - 6, y: y + 10 }, end: { x: width - M + 6, y: y + 10 }, thickness: 0.4, color: rgb(0.85, 0.87, 0.85) });
  }
  y -= 8;
  const units = po.items.reduce((s, i) => s + i.qty, 0);
  text(`${po.items.length} lines, ${units} units`, M, y, 10, bold);
  if (total > 0) text(`Estimated total: ${total.toFixed(2)} EUR (net)`, width - M - 200, y, 10, bold);

  if (po.notes) {
    y -= 30;
    text("Notes", M, y, 9, bold, MUTED);
    y -= 13;
    for (const line of po.notes.split("\n").slice(0, 8)) {
      text(line.slice(0, 100), M, y, 10);
      y -= 13;
    }
  }
  text("Please confirm this order by email or WhatsApp. Thank you!", M, 50, 9, font, MUTED);
  return doc.save();
}

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
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  const M = 48;
  let y = 790;
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) => page.drawText(safe(String(s ?? "")), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, color = INK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);

  const name = store.name || "Greenland Afro Asia Store";
  text(name, M, y, 16, bold, GREEN);
  right(receipt.title || "Rechnung / Beleg", width - M, y, 12, bold);
  y -= 15;
  const addr = [store.street, [store.postal, store.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (addr) text(addr, M, y, 9, font, MUTED);
  right(`Nr. ${o.receipt_number ?? o.number}`, width - M, y, 10);
  y -= 12;
  const contact = [store.phone && `Tel. ${store.phone}`, store.email].filter(Boolean).join("  ");
  if (contact) text(contact, M, y, 9, font, MUTED);
  right(`Datum: ${new Date(o.paid_at ?? o.created_at).toLocaleDateString("de-DE")}`, width - M, y, 10);
  y -= 12;
  const tax = [store.vat_id && `USt-IdNr. ${store.vat_id}`, receipt.tax_number && `St.-Nr. ${receipt.tax_number}`].filter(Boolean).join("  ");
  if (tax) text(tax, M, y, 9, font, MUTED);
  right(`Bestellung #${o.number}`, width - M, y, 10);

  y -= 34;
  const a = (o.shipping_address ?? {}) as Record<string, string>;
  text("Kunde / Customer", M, y, 9, bold, MUTED);
  y -= 14;
  for (const line of [a.name, a.street, [a.postal, a.city].filter(Boolean).join(" "), o.email].filter(Boolean)) {
    text(line, M, y, 10);
    y -= 13;
  }

  y -= 14;
  const cols = { pos: M, title: M + 24, qty: width - M - 235, vat: width - M - 185, unit: width - M - 115, sum: width - M };
  const header = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: width - 2 * M + 12, height: 20, color: rgb(0.93, 0.95, 0.93) });
    text("#", cols.pos, y, 9, bold);
    text("Artikel", cols.title, y, 9, bold);
    text("Menge", cols.qty, y, 9, bold);
    text("MwSt.", cols.vat, y, 9, bold);
    right("Einzel", cols.unit + 40, y, 9, bold);
    right("Summe", cols.sum, y, 9, bold);
    y -= 22;
  };
  header();
  const items = (o.order_items ?? []) as { title: string; qty: number; unit_price: number; tax_rate: number }[];
  const vat = new Map<number, number>(); // rate → gross
  items.forEach((it, i) => {
    if (y < 140) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
      header();
    }
    const t = it.title.length > 52 ? it.title.slice(0, 51) + "…" : it.title;
    const line = Number(it.unit_price) * it.qty;
    vat.set(Number(it.tax_rate), (vat.get(Number(it.tax_rate)) ?? 0) + line);
    text(String(i + 1), cols.pos, y, 9);
    text(t, cols.title, y, 9);
    text(String(it.qty), cols.qty + 8, y, 9);
    text(`${Number(it.tax_rate)} %`, cols.vat, y, 9);
    right(eur(Number(it.unit_price)), cols.unit + 40, y, 9);
    right(eur(line), cols.sum, y, 9);
    y -= 15;
    page.drawLine({ start: { x: M - 6, y: y + 9 }, end: { x: width - M + 6, y: y + 9 }, thickness: 0.4, color: rgb(0.86, 0.87, 0.86) });
  });

  y -= 10;
  const row = (l: string, v: string, b = false) => {
    text(l, width - M - 230, y, 10, b ? bold : font);
    right(v, width - M, y, 10, b ? bold : font);
    y -= 15;
  };
  const sub = Number(o.subtotal);
  row("Zwischensumme", eur(sub));
  const pack = Number(o.packaging_total) || 0;
  row((o.shipping_methods?.name as string) || "Versand", eur(Number(o.shipping_total) - pack));
  if (pack > 0) row(`Tiefkühl-Verpackung (${o.frozen_boxes} ${Number(o.frozen_boxes) === 1 ? "Box" : "Boxen"})`, eur(pack));
  row("Gesamt inkl. MwSt.", eur(Number(o.total)), true);
  for (const [rate, gross] of [...vat.entries()].sort((x, z) => x[0] - z[0])) row(`darin ${rate} % MwSt.`, eur(gross - gross / (1 + rate / 100)));
  if (Number(o.shipping_total) > 0) row("Versand: MwSt. nach Hauptanteil", "");

  y -= 10;
  const paid: Record<string, string> = {
    stripe: "Bezahlt mit Karte (Stripe)",
    paypal: "Bezahlt mit PayPal",
    viva: "Bezahlt mit Viva Wallet",
    cash: "Zahlung bei Abholung / Lieferung",
    cash_deposit: "Anzahlung online bezahlt, Rest bei Abholung",
    bank: "Zahlung per Überweisung",
  };
  text("Zahlung / Payment", M, y, 9, bold, MUTED);
  y -= 14;
  text(paid[o.payment_method ?? o.payment_provider ?? ""] ?? String(o.payment_provider ?? ""), M, y, 10);
  y -= 13;
  if (o.deposit_amount) {
    text(`Anzahlung: ${eur(Number(o.deposit_amount))}   Offener Betrag: ${eur(Number(o.balance_due))}`, M, y, 10, bold);
    y -= 13;
  } else if (Number(o.balance_due) > 0) {
    text(`Offener Betrag: ${eur(Number(o.balance_due))}`, M, y, 10, bold);
    y -= 13;
  }
  if (o.payment_method === "bank" && !o.paid_at && bank?.iban) {
    text(`Bitte überweisen an ${bank.holder ?? ""}, IBAN ${bank.iban}${bank.bic ? `, BIC ${bank.bic}` : ""}, Verwendungszweck: Bestellung ${o.number}`, M, y, 9);
    y -= 13;
  }
  if (o.pickup_slot) {
    text(`Abholung: ${o.pickup_slot}`, M, y, 10);
    y -= 13;
  }
  const footer = receipt.footer || `${name} · Vielen Dank für Ihren Einkauf!`;
  footer.split("\n").slice(0, 3).forEach((l, i) => text(l, M, 58 - i * 12, 8, font, MUTED));
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
