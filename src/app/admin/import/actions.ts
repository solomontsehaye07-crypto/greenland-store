"use server";

import { revalidateTag } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export type ImportKind = "products" | "stock" | "prices" | "supplier_prices";
type Row = Record<string, string | number | null | undefined>;

export interface ImportResult {
  total: number;
  create: number;
  update: number;
  skipped: number;
  errors: { row: number; message: string }[];
  preview: { row: number; sku: string; action: string; changes: string }[];
  applied: boolean;
}

const n = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : NaN;
};
const s = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
const slugify = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const dateOf = (v: unknown) => {
  const t = s(v);
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); // German 31.12.2026
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
};

/** Validates rows and (when apply=true) writes them. Always returns a preview of what changes. */
export async function runImport(kind: ImportKind, rows: Row[], apply: boolean, filename?: string): Promise<ImportResult> {
  const user = await assertStaff();
  const sb = supabaseAdmin();
  const res: ImportResult = { total: rows.length, create: 0, update: 0, skipped: 0, errors: [], preview: [], applied: false };

  const skus = rows.map((r) => s(r.sku)).filter(Boolean) as string[];
  const { data: existing } = await sb.from("products").select("id, sku, title, price, cost_price, stock, category_id, slug").in("sku", skus.length ? skus : ["-"]);
  const bySku = new Map((existing ?? []).map((p) => [p.sku, p]));
  const { data: cats } = await sb.from("categories").select("id, slug, title");
  const catOf = (v: unknown) => {
    const t = s(v)?.toLowerCase();
    if (!t) return null;
    return cats?.find((c) => c.slug === t || c.title.toLowerCase() === t)?.id ?? undefined;
  };
  const { data: sups } = await sb.from("suppliers").select("id, name");
  const supOf = (v: unknown) => {
    const t = s(v)?.toLowerCase();
    if (!t) return null;
    return sups?.find((x) => x.name.toLowerCase() === t)?.id ?? undefined;
  };

  const writes: (() => PromiseLike<unknown>)[] = [];

  rows.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    const sku = s(r.sku);
    if (!sku) return res.errors.push({ row: rowNo, message: "Missing SKU" });
    const cur = bySku.get(sku);

    if (kind === "products") {
      const price = n(r.price);
      const cost = n(r.cost_price);
      const weight = n(r.weight_g);
      const stock = n(r.stock);
      const reorder = n(r.reorder_point);
      if ([price, cost, weight, stock, reorder].some((x) => Number.isNaN(x))) return res.errors.push({ row: rowNo, message: "A number column contains text" });
      const category_id = catOf(r.category);
      if (category_id === undefined) return res.errors.push({ row: rowNo, message: `Unknown category “${r.category}”` });
      const supplier_id = supOf(r.supplier);
      if (supplier_id === undefined) return res.errors.push({ row: rowNo, message: `Unknown supplier “${r.supplier}” – add it under Suppliers first` });
      const patch: Record<string, unknown> = {};
      if (s(r.title)) patch.title = s(r.title);
      if (s(r.brand)) patch.brand = s(r.brand);
      if (s(r.description)) patch.description = s(r.description);
      if (price !== null) patch.price = price;
      if (cost !== null) patch.cost_price = cost;
      if (weight !== null) patch.weight_g = weight;
      if (reorder !== null) patch.reorder_point = reorder;
      if (category_id) patch.category_id = category_id;
      if (supplier_id) patch.supplier_id = supplier_id;
      if (s(r.image_url)) {
        patch.image_url = s(r.image_url);
        patch.images = [s(r.image_url)];
      }
      if (cur) {
        res.update++;
        res.preview.push({ row: rowNo, sku, action: "update", changes: Object.keys(patch).join(", ") || "no changes" });
        writes.push(() => sb.from("products").update(patch).eq("id", cur.id));
        if (stock !== null && stock !== cur.stock)
          writes.push(() => sb.from("stock_movements").insert({ product_id: cur.id, qty_change: stock - cur.stock, reason: "import", note: filename, created_by: user.id }));
      } else {
        if (!patch.title || price === null) return res.errors.push({ row: rowNo, message: "New products need at least title and price" });
        res.create++;
        res.preview.push({ row: rowNo, sku, action: "create", changes: `${patch.title}, ${price} €` });
        writes.push(async () => {
          const { data } = await sb
            .from("products")
            .insert({ sku, slug: `${slugify(String(patch.title))}-${sku.toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 90), status: "active", ...patch })
            .select("id")
            .single();
          if (data && stock) await sb.from("stock_movements").insert({ product_id: data.id, qty_change: stock, reason: "import", note: filename, created_by: user.id });
        });
      }
    } else if (kind === "stock") {
      if (!cur) return res.errors.push({ row: rowNo, message: `Unknown SKU ${sku}` });
      const qty = n(r.qty ?? r.quantity ?? r.stock);
      if (qty === null || Number.isNaN(qty)) return res.errors.push({ row: rowNo, message: "Missing quantity" });
      const mode = (s(r.mode) ?? "set").toLowerCase();
      const best = dateOf(r.best_before);
      const delta = mode === "add" ? qty : qty - cur.stock;
      if (delta === 0) return res.skipped++;
      res.update++;
      res.preview.push({ row: rowNo, sku, action: mode === "add" ? "receive" : "count", changes: `${cur.stock} → ${cur.stock + delta}${best ? `, best before ${best}` : ""}` });
      writes.push(async () => {
        let batch_id: number | null = null;
        if (delta > 0 && (mode === "add" || best)) {
          const { data: b } = await sb
            .from("stock_batches")
            .insert({ product_id: cur.id, quantity_received: delta, quantity_left: delta, best_before: best, lot_code: s(r.lot) })
            .select("id")
            .single();
          batch_id = b?.id ?? null;
        }
        await sb.from("stock_movements").insert({ product_id: cur.id, batch_id, qty_change: delta, reason: mode === "add" ? "purchase" : "import", note: filename, created_by: user.id });
      });
    } else if (kind === "prices") {
      if (!cur) return res.errors.push({ row: rowNo, message: `Unknown SKU ${sku}` });
      const price = n(r.price);
      const cost = n(r.cost_price);
      if (Number.isNaN(price) || Number.isNaN(cost)) return res.errors.push({ row: rowNo, message: "Price must be a number" });
      const patch: Record<string, number> = {};
      if (price !== null && price !== Number(cur.price)) patch.price = price;
      if (cost !== null && cost !== Number(cur.cost_price)) patch.cost_price = cost;
      if (!Object.keys(patch).length) return res.skipped++;
      res.update++;
      res.preview.push({ row: rowNo, sku, action: "price", changes: patch.price !== undefined ? `${cur.price} € → ${patch.price} €` : `cost → ${patch.cost_price} €` });
      writes.push(() => sb.from("products").update({ ...patch, price_source: "import" }).eq("id", cur.id));
    } else {
      if (!cur) return res.errors.push({ row: rowNo, message: `Unknown SKU ${sku}` });
      const supplier_id = supOf(r.supplier);
      if (!supplier_id) return res.errors.push({ row: rowNo, message: `Unknown supplier “${r.supplier}”` });
      const cost = n(r.cost_price);
      res.update++;
      res.preview.push({ row: rowNo, sku, action: "supplier price", changes: `${r.supplier}: ${cost ?? "—"} €` });
      writes.push(async () => {
        await sb.from("supplier_products").upsert({ supplier_id, product_id: cur.id, supplier_sku: s(r.supplier_sku), cost_price: cost, pack_size: n(r.pack_size) ?? 1, is_preferred: true });
        await sb.from("products").update({ supplier_id, ...(cost !== null ? { cost_price: cost } : {}) }).eq("id", cur.id);
      });
    }
  });

  res.preview = res.preview.slice(0, 200);
  if (apply && writes.length) {
    for (let i = 0; i < writes.length; i += 20) await Promise.all(writes.slice(i, i + 20).map((w) => w()));
    await sb.from("import_jobs").insert({
      kind,
      filename,
      total_rows: res.total,
      ok_rows: res.create + res.update,
      failed_rows: res.errors.length,
      errors: res.errors.slice(0, 100),
      created_by: user.id,
    });
    res.applied = true;
    revalidateTag("catalog");
  }
  return res;
}
