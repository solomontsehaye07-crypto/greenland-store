import "server-only";
import { supabaseAdmin } from "./supabase";
import { buildPurchaseOrderPdf } from "./pdf";
import { sendEmail, sendWhatsAppDocument, waLink } from "./notify";
import { siteUrl } from "./site";

type StoreInfo = { name: string; street: string; postal: string; city: string; phone: string; email?: string };

export async function storeInfo(): Promise<StoreInfo> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.store").single();
  return (data?.value ?? { name: "Greenland Afro Asia Store", street: "", postal: "", city: "", phone: "" }) as StoreInfo;
}

/**
 * Creates one draft refill order per supplier for every low-stock product not already on order.
 * Products without a supplier are skipped and reported.
 */
export async function draftRefillOrders(userId?: string) {
  const sb = supabaseAdmin();
  const { data: low } = await sb.from("low_stock").select("*").eq("on_order", false);
  const bySupplier = new Map<number, typeof low>();
  const noSupplier: string[] = [];
  for (const p of low ?? []) {
    if (!p.supplier_id) {
      noSupplier.push(p.sku);
      continue;
    }
    if (!bySupplier.has(p.supplier_id)) bySupplier.set(p.supplier_id, []);
    bySupplier.get(p.supplier_id)!.push(p);
  }
  const created: number[] = [];
  for (const [supplierId, items] of bySupplier) {
    const { data: sup } = await sb.from("suppliers").select("lead_time_days").eq("id", supplierId).single();
    const expected = new Date(Date.now() + (sup?.lead_time_days ?? 3) * 86400000).toISOString().slice(0, 10);
    const { data: po, error } = await sb
      .from("purchase_orders")
      .insert({ supplier_id: supplierId, status: "draft", kind: "refill", expected_at: expected, created_by: userId ?? null })
      .select("id")
      .single();
    if (error || !po) continue;
    await sb.from("purchase_order_items").insert(
      items!.map((p) => ({
        purchase_order_id: po.id,
        product_id: p.id,
        // refill up to reorder point + reorder qty
        qty: Math.max(1, p.reorder_qty + p.reorder_point - p.stock),
        unit_cost: p.cost_price,
      }))
    );
    created.push(po.id);
  }
  return { created, noSupplier };
}

async function loadPo(id: number) {
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single();
  if (!po) throw new Error("Purchase order not found");
  const { data: items } = await sb
    .from("purchase_order_items")
    .select("qty, unit_cost, note, product_id, ordered, offer_price, products(sku, title, title_de, size_qty, size_unit)")
    .eq("purchase_order_id", id)
    .order("id");
  const { data: sp } = await sb
    .from("supplier_products")
    .select("product_id, supplier_sku")
    .eq("supplier_id", po.supplier_id);
  const refs = new Map((sp ?? []).map((r) => [r.product_id, r.supplier_sku]));
  let shipTo = null;
  if (po.kind === "dropship" && po.order_id) {
    const { data: order } = await sb.from("orders").select("shipping_address, phone").eq("id", po.order_id).single();
    const a = order?.shipping_address as Record<string, string> | null;
    if (a) shipTo = { name: a.name, street: a.street, postal: a.postal, city: a.city, country: a.country ?? "DE", phone: order?.phone ?? "" };
  }
  return { po, items: items ?? [], refs, shipTo };
}

/** The PDF as it looks right now (used by the live preview); nothing is stored. */
export async function poPdfBytes(id: number) {
  const { po, items, refs, shipTo } = await loadPo(id);
  if (po.request_kind === "quote" && !po.offer_token) po.offer_token = await ensureOfferToken(id);
  const store = await storeInfo();
  return buildPurchaseOrderPdf(pdfInput(po, items, refs, shipTo, store));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pdfInput(po: any, items: any[], refs: Map<number, string | null>, shipTo: any, store: StoreInfo) {
  const quote = po.request_kind === "quote";
  if (!quote) items = items.filter((i) => i.ordered !== false);
  return {
    requestKind: (quote ? "quote" : "order") as "quote" | "order",
    number: po.number,
    kind: po.kind,
    date: new Date(po.created_at).toLocaleDateString("de-DE"),
    expected: po.expected_at ? new Date(po.expected_at).toLocaleDateString("de-DE") : null,
    store,
    supplier: po.suppliers,
    showPrices: !quote && po.show_prices !== false,
    items: items.map((i) => {
      const prod = i.products as { sku: string; title: string; title_de: string | null; size_qty: number | null; size_unit: string | null };
      const { size, title } = packSize(prod.title_de || prod.title, prod.size_qty, prod.size_unit);
      return { sku: prod.sku, title, size, qty: i.qty, unit_cost: i.unit_cost, supplier_sku: refs.get(i.product_id), note: i.note };
    }),
    shipTo,
    notes: po.notes,
  };
}

/**
 * Pack size for the PDF ("500 g", "12 pcs"): from the product's size fields, or read from the end of
 * the name ("… Flour 500g"). The size is then taken off the name so it is not printed twice.
 */
export function packSize(name: string, qty: number | null, unit: string | null) {
  const re = /[\s,(-]*(\d+(?:[.,]\d+)?\s?(?:x\s?\d+(?:[.,]\d+)?\s?)?(?:kg|g|gr|mg|ml|cl|l|ltr|lb|oz|pcs|pc|stk|st|pieces|pack|sachets?))\)?\s*$/i;
  const m = name.match(re);
  const fmt = (s: string) => s.replace(/\s+/g, "").replace(/(\d)([a-z])/gi, "$1 $2").replace(/(\d)\s?x\s?(\d)/i, "$1 x $2").replace(/\s+/g, " ").replace(/\bgr\b/i, "g");
  const size = qty != null && unit ? `${Number(qty).toLocaleString("de-DE")} ${unit}` : m ? fmt(m[1]) : null;
  return { size, title: m ? name.slice(0, m.index).trim() || name : name };
}

/** Renders the PDF, stores it in the private "documents" bucket and returns a 7-day signed URL. */
export async function renderPoPdf(id: number) {
  const sb = supabaseAdmin();
  const { po, items, refs, shipTo } = await loadPo(id);
  if (po.request_kind === "quote" && !po.offer_token) po.offer_token = await ensureOfferToken(id);
  const store = await storeInfo();
  const pdf = await buildPurchaseOrderPdf(pdfInput(po, items, refs, shipTo, store));
  const path = `purchase-orders/PO-${po.number}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.pdf`;
  await sb.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  await sb.from("purchase_orders").update({ pdf_path: path }).eq("id", id);
  const { data: signed } = await sb.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { pdf, path, url: signed?.signedUrl ?? "", po, store };
}

/**
 * Sends a PO to the supplier. Email is sent automatically (Resend). For WhatsApp we use the
 * Cloud API when configured; otherwise we return a wa.me link that opens WhatsApp prefilled.
 */
export async function sendPo(id: number, channel: "email" | "whatsapp") {
  const sb = supabaseAdmin();
  const { pdf, url, po, store, path } = await renderPoPdf(id);
  const sup = po.suppliers;
  const quote = po.request_kind === "quote";
  const filename = `${quote ? "PR" : "PO"}-${po.number}.pdf`;
  const message = buildMessage(po, store, "supplier");

  let result: { ok: boolean; error?: string; link?: string };
  if (channel === "email") {
    if (!sup.email) throw new Error("Supplier has no email address");
    result = await sendEmail({
      to: sup.email,
      subject: quote ? `Price request PR-${po.number} – ${store.name}` : `${po.kind === "dropship" ? "Dropship order" : "Order"} PO-${po.number} – ${store.name}`,
      html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      attachments: [{ filename, content: pdf }],
      replyTo: store.email || undefined,
    });
  } else {
    if (!sup.whatsapp && !sup.phone) throw new Error("Supplier has no WhatsApp number");
    const phone = (sup.whatsapp ?? sup.phone)!;
    const api = quote ? { ok: false } : await sendWhatsAppDocument(phone, url, filename, `PO-${po.number} – ${store.name}`);
    result = api.ok ? api : { ok: true, link: waLink(phone, message) };
    void url;
  }
  if (result.ok && !result.link) {
    await sb.from("purchase_order_sends").insert({ purchase_order_id: id, channel, recipient: channel === "email" ? sup.email : sup.whatsapp ?? sup.phone, pdf_path: path });
    await sb.from("purchase_orders").update({ status: nextStatus(po), sent_via: channel, sent_at: new Date().toISOString(), edited_after_send: false }).eq("id", id);
  }
  return { ...result, pdfUrl: url };
}

/** Message text that goes with the PDF file (the PDF itself is attached, never linked). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMessage(po: any, store: StoreInfo, audience: "supplier" | "other") {
  const quote = po.request_kind === "quote";
  const code = `${quote ? "PR" : "PO"}-${po.number}`;
  const sup = po.suppliers;
  if (audience === "other") {
    const what = po.status === "quoted" ? "the offer from" : quote ? "the price request to" : "the order to";
    return `Please check ${what} ${sup.name} (${code}) – PDF attached.\n\n${store.name}`;
  }
  const hello = `Hello ${sup.contact_name ?? sup.name},\n\n`;
  return quote
    ? `${hello}${po.message ? po.message + "\n\n" : ""}attached is a price request from ${store.name} (${code}). This is not an order yet. Please tell us your best net price per unit and whether you have the items in stock.\n\n` +
        (po.offer_token ? `You can also type your prices here: ${offerLink(po.offer_token)}\n\n` : "") +
        `Thank you!\n${store.name}, ${store.phone}`
    : (po.message ? `${po.message}\n\n` : `${hello}attached is our ${po.kind === "dropship" ? "dropship order" : "order"} ${code} from ${store.name}.\n\n`) +
        `${po.message ? "" : "Please confirm availability and delivery date. Thank you!\n"}${store.name}, ${store.phone}`;
}

/** Text and file name for sharing the PDF file through the phone's share sheet (WhatsApp etc.). */
export async function poShareText(id: number, audience: "supplier" | "other") {
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("id, number, status, kind, request_kind, message, offer_token, suppliers(name, contact_name, whatsapp, phone)").eq("id", id).single();
  if (!po) throw new Error("Request not found");
  if (po.request_kind === "quote" && !po.offer_token) po.offer_token = await ensureOfferToken(id);
  const store = await storeInfo();
  return { message: buildMessage(po, store, audience), filename: `${po.request_kind === "quote" ? "PR" : "PO"}-${po.number}.pdf` };
}

/** Status after sending: a price request waits for prices, an order (also an accepted offer) is sent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nextStatus = (po: any) => (po.status === "draft" || (po.status === "quoted" && po.request_kind === "order") ? "sent" : po.status);

export const offerLink = (token: string | null | undefined) => (token ? `${siteUrl()}/offer/${token}` : "");

/** Makes sure a price request has its private link for the supplier. */
export async function ensureOfferToken(id: number) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("purchase_orders").select("offer_token").eq("id", id).single();
  if (data?.offer_token) return data.offer_token as string;
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
  await sb.from("purchase_orders").update({ offer_token: token }).eq("id", id);
  return token;
}

/** The supplier's prices from the private offer link. */
export async function saveOfferFromSupplier(token: string, lines: { product_id: number; price: number | null; available: boolean; note: string }[], note: string, by: string) {
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("id, number, status, request_kind, suppliers(name)").eq("offer_token", token).single();
  if (!po || po.request_kind !== "quote" || !["sent", "quoted", "draft"].includes(po.status)) throw new Error("This price request is closed.");
  for (const l of lines) {
    await sb
      .from("purchase_order_items")
      .update({ offer_price: l.price, offer_available: l.available, offer_note: l.note.slice(0, 200) || null })
      .eq("purchase_order_id", po.id)
      .eq("product_id", l.product_id);
  }
  await sb.from("purchase_orders").update({ status: "quoted", quoted_at: new Date().toISOString(), offer_note: note.slice(0, 1000) || null, offer_by: by.slice(0, 80) || null }).eq("id", po.id);
  const store = await storeInfo();
  if (store.email) {
    const sup = (po.suppliers as unknown as { name: string }).name;
    await sendEmail({
      to: store.email,
      subject: `Prices received from ${sup} (PR-${po.number})`,
      html: `<p>${sup} has sent prices for price request PR-${po.number}.</p><p><a href="${siteUrl()}/manager/orders/suppliers/offer/${po.id}">Open the offer in the Manager app</a></p>`,
    }).catch(() => null);
  }
  return po.number as number;
}

/** Books received quantities into stock as a batch (with optional best-before date). */
export async function receivePo(id: number, lines: { product_id: number; qty: number; best_before?: string | null; lot?: string }[], userId?: string) {
  const sb = supabaseAdmin();
  for (const l of lines.filter((x) => x.qty > 0)) {
    const { data: item } = await sb
      .from("purchase_order_items")
      .select("id, unit_cost, qty_received")
      .eq("purchase_order_id", id)
      .eq("product_id", l.product_id)
      .single();
    const { data: batch } = await sb
      .from("stock_batches")
      .insert({
        product_id: l.product_id,
        quantity_received: l.qty,
        quantity_left: l.qty,
        best_before: l.best_before || null,
        lot_code: l.lot || null,
        cost_price: item?.unit_cost ?? null,
        purchase_order_id: id,
      })
      .select("id")
      .single();
    await sb.from("stock_movements").insert({
      product_id: l.product_id,
      batch_id: batch?.id,
      qty_change: l.qty,
      reason: "purchase",
      unit_cost: item?.unit_cost ?? null,
      reference: `po:${id}`,
      created_by: userId ?? null,
    });
    if (item) await sb.from("purchase_order_items").update({ qty_received: item.qty_received + l.qty }).eq("id", item.id);
    await sb.from("alerts").update({ resolved: true }).eq("product_id", l.product_id).eq("kind", "low_stock");
  }
  const { data: all } = await sb.from("purchase_order_items").select("qty, qty_received").eq("purchase_order_id", id);
  const done = (all ?? []).every((i) => i.qty_received >= i.qty);
  await sb.from("purchase_orders").update({ status: done ? "received" : "partially_received" }).eq("id", id);
}

/** After payment: create and send dropship POs for items fulfilled by suppliers. */
export async function forwardDropshipItems(orderId: string) {
  const sb = supabaseAdmin();
  const { data: items } = await sb
    .from("order_items")
    .select("product_id, qty, products(supplier_id, cost_price)")
    .eq("order_id", orderId)
    .eq("is_dropship", true);
  const groups = new Map<number, { product_id: number; qty: number; unit_cost: number | null }[]>();
  for (const it of items ?? []) {
    const p = it.products as unknown as { supplier_id: number | null; cost_price: number | null };
    if (!p?.supplier_id || !it.product_id) continue;
    if (!groups.has(p.supplier_id)) groups.set(p.supplier_id, []);
    groups.get(p.supplier_id)!.push({ product_id: it.product_id, qty: it.qty, unit_cost: p.cost_price });
  }
  for (const [supplierId, lines] of groups) {
    const { data: po } = await sb
      .from("purchase_orders")
      .insert({ supplier_id: supplierId, kind: "dropship", order_id: orderId, status: "draft" })
      .select("id, suppliers(preferred_channel, email)")
      .single();
    if (!po) continue;
    await sb.from("purchase_order_items").insert(lines.map((l) => ({ ...l, purchase_order_id: po.id })));
    const s = po.suppliers as unknown as { preferred_channel: string; email: string | null };
    if (s?.email && s.preferred_channel !== "whatsapp") await sendPo(po.id, "email").catch(() => null);
  }
}

export interface SupplierInsight {
  product_id: number;
  sku: string;
  title: string;
  image_url: string | null;
  stock: number;
  reorder_point: number;
  reorder_qty: number;
  cost: number | null;
  times: number; // how many refill orders it was on
  qty: number; // total quantity ordered
  last: string | null; // last ordered (ISO)
}

/** Every product linked to a supplier, with how often and how recently it was ordered from them. */
export async function supplierInsights(supplierId: number): Promise<SupplierInsight[]> {
  const sb = supabaseAdmin();
  const [{ data: linked }, { data: own }, { data: hist }] = await Promise.all([
    sb.from("supplier_products").select("product_id, cost_price").eq("supplier_id", supplierId),
    sb.from("products").select("id").eq("supplier_id", supplierId),
    sb
      .from("purchase_order_items")
      .select("product_id, qty, purchase_orders!inner(supplier_id, status, created_at)")
      .eq("purchase_orders.supplier_id", supplierId)
      .neq("purchase_orders.status", "cancelled")
      .limit(5000),
  ]);
  const stats = new Map<number, { times: number; qty: number; last: string | null }>();
  for (const h of hist ?? []) {
    const po = h.purchase_orders as unknown as { status: string; created_at: string };
    if (po.status === "draft") continue;
    const s = stats.get(h.product_id) ?? { times: 0, qty: 0, last: null };
    s.times += 1;
    s.qty += h.qty;
    if (!s.last || po.created_at > s.last) s.last = po.created_at;
    stats.set(h.product_id, s);
  }
  const costs = new Map((linked ?? []).map((l) => [l.product_id, l.cost_price as number | null]));
  const ids = [...new Set([...(linked ?? []).map((l) => l.product_id), ...(own ?? []).map((o) => o.id), ...stats.keys()])];
  if (!ids.length) return [];
  const { data: prods } = await sb.from("products").select("id, sku, title, title_de, image_url, stock, reorder_point, reorder_qty, cost_price").in("id", ids);
  return (prods ?? []).map((p) => {
    const s = stats.get(p.id) ?? { times: 0, qty: 0, last: null };
    return {
      product_id: p.id,
      sku: p.sku,
      title: p.title_de || p.title,
      image_url: p.image_url,
      stock: p.stock,
      reorder_point: p.reorder_point,
      reorder_qty: p.reorder_qty,
      cost: costs.get(p.id) ?? p.cost_price,
      ...s,
    };
  });
}
