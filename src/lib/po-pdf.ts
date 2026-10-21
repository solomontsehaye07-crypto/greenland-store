import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Price request / purchase order PDF. Plain pdf-lib, no server code: it is built on the phone or computer
// (the server only sends the data), so it never hits the server's CPU time limit.

export interface PoPdfInput {
  number: number;
  kind: "refill" | "dropship";
  date: string;
  expected?: string | null;
  store: { name: string; street: string; postal: string; city: string; phone: string; email?: string };
  supplier: { name: string; contact_name?: string | null; address?: string | null; email?: string | null; phone?: string | null };
  items: { sku: string; supplier_sku?: string | null; title: string; size?: string | null; qty: number; unit_cost?: number | null; note?: string | null }[];
  showPrices?: boolean;
  shipTo?: { name: string; street: string; postal: string; city: string; country: string; phone?: string } | null;
  notes?: string | null;
  requestKind?: "quote" | "order"; // quote = price request, nothing is ordered yet
}

export const GREEN = rgb(0.114, 0.361, 0.247);
export const INK = rgb(0.08, 0.13, 0.11);
export const MUTED = rgb(0.42, 0.47, 0.44);

// WinAnsi can't encode every glyph – keep the PDF robust
export const safe = (s: string) =>
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

  const quote = po.requestKind === "quote";
  text(po.store.name, M, y, 16, bold, GREEN);
  text(quote ? "PRICE REQUEST / PREISANFRAGE" : po.kind === "dropship" ? "DROPSHIP ORDER" : "PURCHASE ORDER / BESTELLUNG", width - M - 220, y, 11, bold);
  y -= 16;
  text(`${po.store.street}, ${po.store.postal} ${po.store.city}`, M, y, 9, font, MUTED);
  text(`No. ${quote ? "PR" : "PO"}-${po.number}`, width - M - 220, y, 10);
  y -= 12;
  text(`Tel. ${po.store.phone}${po.store.email ? "  " + po.store.email : ""}`, M, y, 9, font, MUTED);
  text(`Date: ${po.date}`, width - M - 220, y, 10);
  if (po.expected && !quote) {
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

  // Fits text into a column: wraps onto a second line, then shortens with "..." – never runs into the next column.
  const wrap = (str: string, w: number, size: number, f = font, maxLines = 2) => {
    const words = safe(str).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    const fits = (t: string) => f.widthOfTextAtSize(t, size) <= w;
    // a single word wider than the column (long codes) is split into pieces that fit
    const pieces = words.flatMap((wd) => {
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
    for (const word of pieces) {
      const next = cur ? `${cur} ${word}` : word;
      if (fits(next)) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    const out = lines.slice(0, maxLines).map((l) => {
      let t = l;
      while (!fits(t) && t.length > 1) t = t.slice(0, -1);
      return t;
    });
    if (lines.length > maxLines) {
      let last = out[maxLines - 1];
      while (!fits(`${last}...`) && last.length > 1) last = last.slice(0, -1);
      out[maxLines - 1] = `${last.trimEnd()}...`;
    }
    return out;
  };

  if (quote) {
    y -= 14;
    const intro = [
      ...wrap("This is a price request, not an order. Please send us your best net price per unit and tell us if an item is not available.", width - 2 * M, 9.5, bold),
      ...wrap("Dies ist eine Preisanfrage, keine Bestellung. Bitte nennen Sie uns Ihren besten Netto-Stueckpreis und teilen Sie uns mit, was nicht lieferbar ist.", width - 2 * M, 9.5),
    ];
    page.drawRectangle({ x: M - 6, y: y - 13 * (intro.length - 1) - 8, width: width - 2 * M + 12, height: 13 * intro.length + 10, color: rgb(0.99, 0.96, 0.88) });
    intro.forEach((l, i) => {
      text(l, M, y, 9.5, i < intro.length / 2 ? bold : font);
      y -= 13;
    });
  }

  // table: No. | SKU | (Supplier ref) | Product | Size | Qty | (Unit cost)
  y -= 18;
  const right = width - M;
  const showCost = !quote && po.showPrices !== false;
  const hasRef = po.items.some((i) => i.supplier_sku);
  type Col = { key: string; label: string; w: number; align?: "right" };
  const cols: Col[] = [
    { key: "no", label: "No.", w: 24 },
    { key: "sku", label: "SKU", w: 62 },
    ...(hasRef ? [{ key: "ref", label: "Supplier ref", w: 62 }] : []),
    { key: "title", label: "Product", w: 0 },
    { key: "size", label: "Size", w: 58 },
    { key: "qty", label: "Qty", w: 34, align: "right" as const },
    ...(showCost ? [{ key: "cost", label: "Unit cost", w: 62, align: "right" as const }] : []),
  ];
  const GAP = 8;
  const fixed = cols.reduce((t, c) => t + c.w, 0) + GAP * (cols.length - 1);
  cols.find((c) => c.key === "title")!.w = right - M - fixed;
  const xs: number[] = [];
  cols.reduce((x, c) => (xs.push(x), x + c.w + GAP), M);
  const put = (c: Col, i: number, str: string, yy: number, size: number, f = font, color = INK) => {
    const x = c.align === "right" ? xs[i] + c.w - f.widthOfTextAtSize(safe(str), size) : xs[i];
    text(str, x, yy, size, f, color);
  };
  const header = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: width - 2 * M + 12, height: 20, color: rgb(0.89, 0.93, 0.9) });
    cols.forEach((c, i) => put(c, i, c.label, y, 9, bold));
    y -= 22;
  };
  header();
  let total = 0;
  po.items.forEach((it, n) => {
    const cell: Record<string, string[]> = {
      no: [String(n + 1)],
      sku: wrap(it.sku, cols[1].w, 9, font, 1),
      ref: wrap(it.supplier_sku ?? "", 62, 9, font, 2),
      title: wrap(it.title, cols.find((c) => c.key === "title")!.w, 9),
      size: wrap(it.size ?? "-", 58, 9, font, 2),
      qty: [String(it.qty)],
      cost: showCost && it.unit_cost != null ? [`${Number(it.unit_cost).toFixed(2)} EUR`] : [""],
    };
    const note = it.note ? wrap(it.note, cols.find((c) => c.key === "title")!.w, 8, font, 2) : [];
    const lines = Math.max(...cols.map((c) => (c.key === "title" ? cell.title.length + note.length : cell[c.key].length)), 1);
    const h = 11 * lines + 7;
    if (y - h < 80) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
      header();
    }
    cols.forEach((c, i) =>
      cell[c.key].forEach((l, k) => put(c, i, l, y - 11 * k, c.key === "qty" ? 10 : 9, c.key === "qty" || c.key === "no" ? bold : font, c.key === "no" ? MUTED : INK))
    );
    const ti = cols.findIndex((c) => c.key === "title");
    note.forEach((l, k) => text(l, xs[ti], y - 11 * (cell.title.length + k), 8, font, MUTED));
    if (showCost && it.unit_cost != null) total += Number(it.unit_cost) * it.qty;
    y -= h;
    page.drawLine({ start: { x: M - 6, y: y + 9 }, end: { x: right + 6, y: y + 9 }, thickness: 0.4, color: rgb(0.85, 0.87, 0.85) });
  });
  y -= 8;
  const units = po.items.reduce((t, i) => t + i.qty, 0);
  text(`${po.items.length} products, ${units} units`, M, y, 10, bold);
  if (total > 0) {
    const t = `Total: ${total.toFixed(2)} EUR (net)`;
    text(t, right - bold.widthOfTextAtSize(t, 10), y, 10, bold);
  }

  if (po.notes) {
    y -= 30;
    text("Notes", M, y, 9, bold, MUTED);
    y -= 13;
    for (const line of po.notes.split("\n").slice(0, 8).flatMap((l) => wrap(l, width - 2 * M, 10, font, 3))) {
      text(line, M, y, 10);
      y -= 13;
    }
  }
  text(quote ? "Please reply with your prices by email or WhatsApp. Thank you! / Vielen Dank!" : "Please confirm this order by email or WhatsApp. Thank you!", M, 50, 9, font, MUTED);
  return doc.save();
}

