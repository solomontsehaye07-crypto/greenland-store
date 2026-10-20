import "server-only";
import { supabaseAdmin } from "./supabase";

const slugify = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

/** Next free shop SKU like GRL-000842. */
export async function nextSku() {
  const { data } = await supabaseAdmin().from("products").select("sku").like("sku", "GRL-%").order("sku", { ascending: false }).limit(1);
  const n = Number(String(data?.[0]?.sku ?? "GRL-000000").replace(/\D/g, "")) + 1;
  return `GRL-${String(n).padStart(6, "0")}`;
}

export interface NewProduct {
  title_de: string;
  title?: string;
  category_id: number | null;
  price: number;
  tax_rate: number;
  cost_price?: number | null;
  ean?: string | null;
  brand?: string | null;
  image_url?: string | null;
  supplier_id?: number | null;
  status?: "active" | "hidden" | "draft";
}

/** Creates a product (stock starts at 0; stock is added with a delivery). */
export async function createProduct(p: NewProduct) {
  const sb = supabaseAdmin();
  const sku = await nextSku();
  const title = (p.title || p.title_de).trim();
  const { data, error } = await sb
    .from("products")
    .insert({
      sku,
      slug: `${slugify(title)}-${sku.toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 90),
      title,
      title_de: p.title_de.trim(),
      category_id: p.category_id,
      price: p.price,
      tax_rate: p.tax_rate,
      cost_price: p.cost_price ?? null,
      ean: p.ean || null,
      brand: p.brand || null,
      image_url: p.image_url || null,
      images: p.image_url ? [p.image_url] : [],
      supplier_id: p.supplier_id ?? null,
      status: p.status ?? "active",
      price_source: "manual",
    })
    .select("id, sku, title, title_de, image_url, stock, cost_price")
    .single();
  if (error) throw new Error(error.message);
  if (p.supplier_id) await sb.from("supplier_products").upsert({ supplier_id: p.supplier_id, product_id: data.id, cost_price: p.cost_price ?? null, is_preferred: true });
  return data;
}

export interface Delivery {
  product_id: number;
  qty: number;
  cost?: number | null; // net purchase price per item
  best_before?: string | null;
  lot?: string | null;
}

/** Adds delivered goods to the existing stock (a batch per line, average cost updates by trigger). */
export async function bookDelivery(lines: Delivery[], opts: { userId?: string; supplierId?: number | null; note?: string | null } = {}) {
  const sb = supabaseAdmin();
  const done: { product_id: number; qty: number }[] = [];
  for (const l of lines) {
    const qty = Math.round(Number(l.qty));
    if (!l.product_id || !qty || qty <= 0) continue;
    const cost = l.cost == null || Number.isNaN(Number(l.cost)) ? null : Number(l.cost);
    const { data: b } = await sb
      .from("stock_batches")
      .insert({ product_id: l.product_id, quantity_received: qty, quantity_left: qty, cost_price: cost, best_before: l.best_before || null, lot_code: l.lot || null })
      .select("id")
      .single();
    const { error } = await sb.from("stock_movements").insert({
      product_id: l.product_id,
      batch_id: b?.id,
      qty_change: qty,
      reason: "purchase",
      unit_cost: cost,
      note: opts.note ?? "Goods in",
      created_by: opts.userId ?? null,
    });
    if (error) throw new Error(error.message);
    if (opts.supplierId) {
      await sb.from("supplier_products").upsert({ supplier_id: opts.supplierId, product_id: l.product_id, ...(cost !== null ? { cost_price: cost } : {}) }, { onConflict: "supplier_id,product_id" });
      await sb.from("products").update({ supplier_id: opts.supplierId }).eq("id", l.product_id).is("supplier_id", null);
    }
    await sb.from("alerts").update({ resolved: true }).eq("product_id", l.product_id).eq("kind", "low_stock");
    done.push({ product_id: l.product_id, qty });
  }
  return done;
}
