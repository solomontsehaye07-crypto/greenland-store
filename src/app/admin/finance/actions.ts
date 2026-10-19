"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { applyRecommended, getPricingSettings } from "@/lib/pricing";

const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\./g, (m, i, all) => (all.includes(",") ? "" : m)).replace(",", ".");
  if (!s) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};
const text = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

function back(fd: FormData, msg: string): never {
  const ret = String(fd.get("return") || "/admin/finance");
  const url = new URL(ret, "http://x");
  url.searchParams.set("msg", msg);
  redirect(url.pathname + url.search);
}

/** The product picker sends "SKU – title"; find the product by its SKU. */
async function productFrom(fd: FormData) {
  const raw = String(fd.get("product") ?? "").trim();
  const sku = raw.split(/\s[–-]\s/)[0].trim();
  if (!sku) return null;
  const { data } = await supabaseAdmin().from("products").select("id, title, cost_price").eq("sku", sku).maybeSingle();
  return data;
}

function done() {
  revalidateTag("catalog");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
}

export async function recordWriteoff(fd: FormData) {
  const user = await assertStaff();
  const p = await productFrom(fd);
  const qty = Math.abs(Math.round(Number(fd.get("qty"))));
  const reason = ["spoiled", "damage", "expired"].includes(String(fd.get("reason"))) ? String(fd.get("reason")) : "spoiled";
  if (!p) back(fd, "Product not found. Pick it from the list.");
  if (!qty) back(fd, "Enter how many items were thrown away.");
  const cost = dec(fd.get("cost"));
  const { error } = await supabaseAdmin().from("stock_movements").insert({
    product_id: p.id, qty_change: -qty, reason, unit_cost: cost ?? p.cost_price, note: text(fd.get("note")), created_by: user.id,
  });
  if (error) back(fd, `Could not save: ${error.message}`);
  done();
  back(fd, `Write-off saved: ${qty} × ${p.title}${p.cost_price == null && cost == null ? " (no purchase cost yet, so it is not valued)" : ""}.`);
}

export async function recordDelivery(fd: FormData) {
  const user = await assertStaff();
  const p = await productFrom(fd);
  const qty = Math.abs(Math.round(Number(fd.get("qty"))));
  const cost = dec(fd.get("cost"));
  if (!p) back(fd, "Product not found. Pick it from the list.");
  if (!qty) back(fd, "Enter the delivered quantity.");
  if (cost === null) back(fd, "Enter the net purchase cost per item.");
  const sb = supabaseAdmin();
  const { data: b } = await sb.from("stock_batches").insert({ product_id: p.id, quantity_received: qty, quantity_left: qty, cost_price: cost, best_before: text(fd.get("best_before")) }).select("id").single();
  const { error } = await sb.from("stock_movements").insert({ product_id: p.id, batch_id: b?.id, qty_change: qty, reason: "purchase", unit_cost: cost, note: text(fd.get("note")), created_by: user.id });
  if (error) back(fd, `Could not save: ${error.message}`);
  let extra = "";
  if ((await getPricingSettings()).autoApply) {
    const n = await applyRecommended([p.id], user.id, "auto (delivery)");
    if (n) extra = " Price adjusted to the new cost.";
  }
  done();
  back(fd, `Delivery booked: ${qty} × ${p.title} at ${cost.toFixed(2).replace(".", ",")} €.${extra}`);
}

export async function addStoreSale(fd: FormData) {
  const user = await assertStaff();
  const day = text(fd.get("day"));
  const g7 = dec(fd.get("gross_7")) ?? 0;
  const g19 = dec(fd.get("gross_19")) ?? 0;
  if (!day) back(fd, "Pick the day.");
  if (g7 < 0 || g19 < 0 || g7 + g19 === 0) back(fd, "Enter the till totals.");
  await supabaseAdmin().from("store_sales").insert({ day, gross_7: g7, gross_19: g19, note: text(fd.get("note")), created_by: user.id });
  done();
  back(fd, "Till total saved.");
}

export async function addExpense(fd: FormData) {
  const user = await assertStaff();
  const day = text(fd.get("day"));
  const amount = dec(fd.get("amount"));
  const category = text(fd.get("category")) ?? "Other";
  if (!day || amount === null || amount < 0) back(fd, "Enter the date and amount.");
  await supabaseAdmin().from("expenses").insert({ day, category, amount, note: text(fd.get("note")), created_by: user.id });
  done();
  back(fd, "Expense saved.");
}

export async function deleteEntry(fd: FormData) {
  await assertStaff();
  const table = String(fd.get("table"));
  const id = Number(fd.get("id"));
  if (!["store_sales", "expenses"].includes(table) || !id) back(fd, "Nothing deleted.");
  await supabaseAdmin().from(table).delete().eq("id", id);
  done();
  back(fd, "Entry deleted.");
}
