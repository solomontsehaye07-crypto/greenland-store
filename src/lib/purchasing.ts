import "server-only";
import { supabaseAdmin } from "./supabase";
import { buildPurchaseOrderPdf } from "./pdf";
import { sendEmail, sendWhatsAppDocument, waLink } from "./notify";

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
    .select("qty, unit_cost, product_id, products(sku, title)")
    .eq("purchase_order_id", id);
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

/** Renders the PDF, stores it in the private "documents" bucket and returns a 7-day signed URL. */
export async function renderPoPdf(id: number) {
  const sb = supabaseAdmin();
  const { po, items, refs, shipTo } = await loadPo(id);
  const store = await storeInfo();
  const pdf = await buildPurchaseOrderPdf({
    number: po.number,
    kind: po.kind,
    date: new Date(po.created_at).toLocaleDateString("de-DE"),
    expected: po.expected_at ? new Date(po.expected_at).toLocaleDateString("de-DE") : null,
    store,
    supplier: po.suppliers,
    items: items.map((i) => {
      const prod = i.products as unknown as { sku: string; title: string };
      return { sku: prod.sku, title: prod.title, qty: i.qty, unit_cost: i.unit_cost, supplier_sku: refs.get(i.product_id) };
    }),
    shipTo,
    notes: po.notes,
  });
  const path = `purchase-orders/PO-${po.number}.pdf`;
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
  const { pdf, url, po, store } = await renderPoPdf(id);
  const sup = po.suppliers;
  const filename = `PO-${po.number}.pdf`;
  const message =
    `Hello ${sup.contact_name ?? sup.name},\n\n` +
    `please find our ${po.kind === "dropship" ? "dropship order" : "refill order"} PO-${po.number} from ${store.name}.\n` +
    `PDF: ${url}\n\nPlease confirm availability and delivery date. Thank you!\n${store.name}, ${store.phone}`;

  let result: { ok: boolean; error?: string; link?: string };
  if (channel === "email") {
    if (!sup.email) throw new Error("Supplier has no email address");
    result = await sendEmail({
      to: sup.email,
      subject: `${po.kind === "dropship" ? "Dropship order" : "Order"} PO-${po.number} – ${store.name}`,
      html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      attachments: [{ filename, content: pdf }],
      replyTo: store.email || undefined,
    });
  } else {
    if (!sup.whatsapp && !sup.phone) throw new Error("Supplier has no WhatsApp number");
    const phone = (sup.whatsapp ?? sup.phone)!;
    const api = await sendWhatsAppDocument(phone, url, filename, `PO-${po.number} – ${store.name}`);
    result = api.ok ? api : { ok: true, link: waLink(phone, message) };
  }
  if (result.ok && !result.link) {
    await sb.from("purchase_orders").update({ status: "sent", sent_via: channel, sent_at: new Date().toISOString() }).eq("id", id);
  }
  return { ...result, pdfUrl: url };
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
