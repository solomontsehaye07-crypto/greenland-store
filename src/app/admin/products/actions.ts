"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { bookDelivery, createProduct } from "@/lib/products-admin";

/** "4,99" / "4.99" / "" → number | null */
const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const txt = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

function back(fd: FormData, msg: string, keepOpen = true): never {
  const url = new URL(String(fd.get("return") || "/admin/products"), "http://x");
  url.searchParams.set("msg", msg);
  if (!keepOpen) url.searchParams.delete("edit");
  redirect(url.pathname + url.search);
}

function refresh(id?: number) {
  updateTag("catalog");
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  if (id) revalidatePath(`/admin/products/${id}`);
}

/** Saves everything in the product panel: photos, prices, offer, texts, flags and which home sections show it. */
export async function saveProduct(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const sb = supabaseAdmin();
  const regular = dec(fd.get("regular_price"));
  const offer = dec(fd.get("offer_price"));
  if (regular === null || regular <= 0) back(fd, "Please enter the regular price.");
  if (offer !== null && offer >= regular) back(fd, "The offer price must be lower than the regular price.");

  let images: string[] = [];
  try {
    images = (JSON.parse(String(fd.get("images") ?? "[]")) as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    /* keep empty */
  }
  const endsRaw = txt(fd.get("sale_ends_at"));
  const patch: Record<string, unknown> = {
    title: txt(fd.get("title")),
    title_de: txt(fd.get("title_de")),
    brand: txt(fd.get("brand")),
    ean: txt(fd.get("ean")),
    description: txt(fd.get("description")),
    description_de: txt(fd.get("description_de")),
    country: txt(fd.get("country")),
    also_countries: String(fd.get("also_countries") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    status: txt(fd.get("status")) ?? "active",
    category_id: Number(fd.get("category_id")) || null,
    tax_rate: Number(fd.get("tax_rate")) || 7,
    weight_g: Number(fd.get("weight_g")) || 0,
    cost_price: dec(fd.get("cost_price")),
    price: offer ?? regular,
    compare_at_price: offer !== null ? regular : null,
    sale_ends_at: offer !== null && endsRaw ? new Date(`${endsRaw}T23:59:59`).toISOString() : null,
    images,
    image_url: images[0] ?? null,
  };
  for (const k of ["featured", "is_frozen", "age_restricted", "is_dropship"]) if (fd.has(`${k}__present`)) patch[k] = fd.get(k) === "on";
  if (!patch.title) back(fd, "Please enter a title.");

  const { data: before } = await sb.from("products").select("price").eq("id", id).single();
  const { error } = await sb.from("products").update(patch).eq("id", id);
  if (error) back(fd, `Could not save: ${error.message}`);
  if (before && Number(before.price) !== Number(patch.price))
    await sb.from("price_changes").insert({ product_id: id, old_price: before.price, new_price: patch.price, cost_price: patch.cost_price, source: offer !== null ? "offer" : "manual" });

  // home sections with hand-picked products
  const offered = fd.getAll("sections").map(Number);
  const { data: secs } = await sb.from("home_sections").select("id, data").in("type", ["products", "offers"]);
  for (const s of secs ?? []) {
    const d = (s.data ?? {}) as Record<string, unknown>;
    if (d.source !== "picked") continue;
    const ids = (Array.isArray(d.productIds) ? d.productIds : []).map(Number);
    const has = ids.includes(id);
    const want = offered.includes(s.id);
    if (has === want) continue;
    const next = want ? [...ids, id] : ids.filter((x) => x !== id);
    await sb.from("home_sections").update({ data: { ...d, productIds: next } }).eq("id", s.id);
  }

  refresh(id);
  back(fd, "Saved. The shop shows the changes now.");
}

/** Quick price change from the product list. */
export async function quickPrice(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const price = dec(fd.get("price"));
  if (!id || price === null || price <= 0) back(fd, "Enter a valid price.", false);
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("products").select("price, compare_at_price, cost_price, title").eq("id", id).single();
  if (!p) back(fd, "Product not found.", false);
  const patch: Record<string, unknown> = { price, price_source: "manual" };
  // a price at or above the "before" price ends the offer
  if (p.compare_at_price && price >= Number(p.compare_at_price)) Object.assign(patch, { compare_at_price: null, sale_ends_at: null });
  await sb.from("products").update(patch).eq("id", id);
  if (Number(p.price) !== price) await sb.from("price_changes").insert({ product_id: id, old_price: p.price, new_price: price, cost_price: p.cost_price, source: "manual" });
  refresh(id);
  back(fd, `${p.title}: price saved.`, false);
}

/** Ends the offer on one product: the "before" price becomes the price again. */
export async function endOffer(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("products").select("price, compare_at_price").eq("id", id).single();
  if (p?.compare_at_price) await sb.from("products").update({ price: p.compare_at_price, compare_at_price: null, sale_ends_at: null }).eq("id", id);
  refresh(id);
  back(fd, "Offer ended.");
}

/** "New product" panel: creates the product, books the first stock, then opens the full editor. */
export async function createProductAction(fd: FormData) {
  const user = await assertStaff();
  const title_de = txt(fd.get("title_de"));
  const price = dec(fd.get("price"));
  const category_id = Number(fd.get("category_id")) || null;
  const ret = "/admin/products?new=1";
  if (!title_de) back(fd, "Please enter the product name.");
  if (!price || price <= 0) back(fd, "Please enter the selling price.");
  if (!category_id) back(fd, "Please choose a category.");
  let id: number;
  try {
    const p = await createProduct({
      title_de: title_de!,
      title: txt(fd.get("title")) ?? undefined,
      brand: txt(fd.get("brand")),
      ean: txt(fd.get("ean")),
      category_id,
      price: price!,
      tax_rate: Number(fd.get("tax_rate")) || 7,
      cost_price: dec(fd.get("cost_price")),
      image_url: txt(fd.get("image_url")),
      supplier_id: Number(fd.get("supplier_id")) || null,
    });
    id = p.id;
    const qty = Number(fd.get("stock")) || 0;
    if (qty > 0) await bookDelivery([{ product_id: id, qty, cost: dec(fd.get("cost_price")), best_before: txt(fd.get("best_before")) }], { userId: user.id, supplierId: Number(fd.get("supplier_id")) || null, note: "First stock" });
  } catch (e) {
    void ret;
    back(fd, `Could not create: ${(e as Error).message}`);
  }
  refresh(id!);
  redirect(`/admin/products?edit=${id!}&msg=${encodeURIComponent("Product created. Add more photos and texts here.")}`);
}
