import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PoPdfInput {
  number: number;
  kind: "refill" | "dropship";
  date: string;
  expected?: string | null;
  store: { name: string; street: string; postal: string; city: string; phone: string; email?: string };
  supplier: { name: string; contact_name?: string | null; address?: string | null; email?: string | null; phone?: string | null };
  items: { sku: string; supplier_sku?: string | null; title: string; qty: number; unit_cost?: number | null }[];
  shipTo?: { name: string; street: string; postal: string; city: string; country: string; phone?: string } | null;
  notes?: string | null;
}

const GREEN = rgb(0.114, 0.361, 0.247);
const INK = rgb(0.08, 0.13, 0.11);
const MUTED = rgb(0.42, 0.47, 0.44);

// WinAnsi can't encode every glyph – keep the PDF robust
const safe = (s: string) =>
  s.normalize("NFKD").replace(/[^\x20-\x7E -ÿ]/g, "").replace(/–|—/g, "-");

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
    ["SKU", "Supplier ref", "Product", "Qty", "Unit cost"].forEach((h, i) => text(h, cols[i], y, 9, bold));
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
    if (it.unit_cost != null) {
      text(`${Number(it.unit_cost).toFixed(2)} EUR`, cols[4], y, 9);
      total += Number(it.unit_cost) * it.qty;
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
