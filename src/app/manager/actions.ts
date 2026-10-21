"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { setOrderStatus, markOrderPaid } from "../admin/actions";
import { storeFrom } from "@/lib/designs";
import { validTypes } from "@/lib/supplier-types";

const back = (path: string, msg: string): never => redirect(`${path}?msg=${encodeURIComponent(msg)}`);
const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

export async function tillTotal(fd: FormData) {
  const user = await assertStaff(MANAGER_ROLES);
  const day = String(fd.get("day") || new Date().toISOString().slice(0, 10));
  const g7 = dec(fd.get("gross_7"));
  const g19 = dec(fd.get("gross_19"));
  if (g7 + g19 <= 0) back("/manager", "Enter the till totals.");
  await supabaseAdmin().from("store_sales").insert({ day, gross_7: g7, gross_19: g19, created_by: user.id });
  revalidatePath("/manager");
  back("/manager", "Till total saved.");
}

export async function moveOrder(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  fd.set("notify", "on");
  await setOrderStatus(fd);
  revalidatePath("/manager/orders");
  back("/manager/orders", "Order updated and the customer was emailed.");
}

export async function collectRest(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  await markOrderPaid(fd);
  revalidatePath("/manager/orders");
  back("/manager/orders", "Payment recorded.");
}

/** Puts a product on the open draft refill request of its supplier (creates one if needed). */
export async function addToRefill(fd: FormData) {
  const user = await assertStaff(MANAGER_ROLES);
  const pid = Number(fd.get("product_id"));
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("products").select("supplier_id, reorder_qty, reorder_point, stock, cost_price").eq("id", pid).single();
  let supplier = p?.supplier_id ?? null;
  if (!supplier) {
    const { data: sp } = await sb.from("supplier_products").select("supplier_id").eq("product_id", pid).order("is_preferred", { ascending: false }).limit(1);
    supplier = sp?.[0]?.supplier_id ?? null;
  }
  if (!supplier || !p) back("/manager/stock", "This product has no supplier yet. Set one in the admin (product → stock & supplier).");
  let { data: po } = await sb.from("purchase_orders").select("id").eq("supplier_id", supplier).eq("status", "draft").eq("kind", "refill").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!po) po = (await sb.from("purchase_orders").insert({ supplier_id: supplier, status: "draft", kind: "refill", created_by: user.id }).select("id").single()).data;
  const { data: has } = await sb.from("purchase_order_items").select("id").eq("purchase_order_id", po!.id).eq("product_id", pid).maybeSingle();
  if (!has) await sb.from("purchase_order_items").insert({ purchase_order_id: po!.id, product_id: pid, qty: Math.max(1, p!.reorder_qty + p!.reorder_point - p!.stock), unit_cost: p!.cost_price });
  revalidatePath("/manager/stock");
  back("/manager/stock", has ? "Already on the refill request." : "Added to the refill request.");
}

// ---------------- store controls ----------------

async function upsert(key: string, value: unknown) {
  await supabaseAdmin().from("settings").upsert({ key, value }, { onConflict: "key" });
}

export async function setPaused(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const paused = fd.get("paused") === "true";
  const de = String(fd.get("message_de") ?? "").trim();
  const en = String(fd.get("message_en") ?? "").trim();
  await upsert("public.shop", { paused, message: { de, en } });
  revalidatePath("/", "layout");
  back("/manager/controls", paused ? "Online orders are paused. Customers see your message." : "Online orders are open again.");
}

export async function toggleDelivery(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  await supabaseAdmin().from("shipping_methods").update({ active: fd.get("active") === "true" }).eq("id", Number(fd.get("id")));
  revalidatePath("/", "layout");
  back("/manager/controls", "Delivery option updated.");
}

export async function useDesignNow(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("key, value").in("key", ["public.designs", "public.theme"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  const store = storeFrom(get("public.designs"), get("public.theme") as Record<string, string> | undefined);
  const id = String(fd.get("id"));
  if (store.presets.some((p) => p.id === id)) store.active = id;
  await upsert("public.designs", store);
  revalidatePath("/", "layout");
  back("/manager/controls", "Design switched.");
}

export async function setTopBar(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("value").eq("key", "public.site").maybeSingle();
  const site = { ...((data?.value as Record<string, unknown>) ?? {}) };
  const de = String(fd.get("de") ?? "").trim();
  const en = String(fd.get("en") ?? "").trim();
  const rest = ((site.announcements as { text: { de?: string; en?: string } }[] | undefined) ?? []).slice(1);
  site.announcements = de || en ? [{ text: { de, en } }, ...rest] : rest;
  await upsert("public.site", site);
  revalidatePath("/", "layout");
  back("/manager/controls", "Top-bar message saved.");
}

// ---------------- refill order form (Manager → Refill) ----------------

const refillBack = (fd: FormData, msg?: string): never => {
  const u = new URLSearchParams();
  const s = String(fd.get("supplier_id") ?? "");
  const q = String(fd.get("q") ?? "");
  if (s) u.set("s", s);
  if (q) u.set("q", q);
  if (msg) u.set("msg", msg);
  redirect(`/manager/orders/suppliers${u.toString() ? `?${u}` : ""}`);
};

/** Open draft for a supplier, created on first use. */
async function draftFor(supplierId: number, userId: string) {
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("id").eq("supplier_id", supplierId).eq("status", "draft").eq("kind", "refill").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (po) return po.id as number;
  const { data: sup } = await sb.from("suppliers").select("lead_time_days").eq("id", supplierId).single();
  const expected = new Date(Date.now() + (sup?.lead_time_days ?? 3) * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("purchase_orders").insert({ supplier_id: supplierId, status: "draft", kind: "refill", expected_at: expected, created_by: userId }).select("id").single();
  return data!.id as number;
}

export async function refillAdd(fd: FormData) {
  const user = await assertStaff(MANAGER_ROLES);
  const supplierId = Number(fd.get("supplier_id"));
  const pid = Number(fd.get("product_id"));
  if (!supplierId || !pid) refillBack(fd, "Choose a supplier first.");
  const sb = supabaseAdmin();
  const poId = await draftFor(supplierId, user.id);
  const { data: p } = await sb.from("products").select("reorder_qty, reorder_point, stock, cost_price").eq("id", pid).single();
  const { data: has } = await sb.from("purchase_order_items").select("id, qty").eq("purchase_order_id", poId).eq("product_id", pid).maybeSingle();
  const wanted = Math.round(Number(fd.get("qty")) || 0);
  if (has) await sb.from("purchase_order_items").update({ qty: has.qty + (wanted > 0 ? wanted : 1) }).eq("id", has.id);
  else {
    const suggested = wanted > 0 ? wanted : p ? Math.max(1, (p.reorder_qty || 0) + (p.reorder_point || 0) - (p.stock || 0)) : 1;
    await sb.from("purchase_order_items").insert({ purchase_order_id: poId, product_id: pid, qty: suggested, unit_cost: p?.cost_price ?? null });
  }
  await sb.from("purchase_orders").update({ updated_at: new Date().toISOString() }).eq("id", poId);
  revalidatePath("/manager/orders/suppliers");
  refillBack(fd);
}

export async function refillQty(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(fd.get("item_id"));
  const sb = supabaseAdmin();
  const { data: it } = await sb.from("purchase_order_items").select("id, qty, purchase_order_id, purchase_orders(status)").eq("id", id).single();
  if (!it || (it.purchase_orders as unknown as { status: string })?.status !== "draft") refillBack(fd, "This request was already sent.");
  const set = fd.get("qty");
  const qty = set != null && String(set).trim() !== "" ? Math.round(Number(set)) : it!.qty + Number(fd.get("delta") || 0);
  if (!Number.isFinite(qty) || qty <= 0) await sb.from("purchase_order_items").delete().eq("id", id);
  else await sb.from("purchase_order_items").update({ qty: Math.min(9999, qty) }).eq("id", id);
  revalidatePath("/manager/orders/suppliers");
  refillBack(fd);
}

export async function refillMessage(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const poId = Number(fd.get("po_id"));
  await supabaseAdmin().from("purchase_orders").update({ message: String(fd.get("message") ?? "").slice(0, 1500) || null, updated_at: new Date().toISOString() }).eq("id", poId).eq("status", "draft");
  revalidatePath("/manager/orders/suppliers");
  refillBack(fd, "Message saved.");
}

/** Adds a supplier from the Manager app and opens its order list. */
export async function addSupplier(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const name = t("name");
  if (!name) redirect("/manager/orders/suppliers?new=1&msg=" + encodeURIComponent("Please enter the company name."));
  const email = t("email") || null;
  const whatsapp = t("whatsapp").replace(/[^\d+]/g, "") || null;
  const pref = ["email", "whatsapp", "both"].includes(t("preferred_channel")) ? t("preferred_channel") : whatsapp ? "whatsapp" : "email";
  const sb = supabaseAdmin();
  const { data: dup } = await sb.from("suppliers").select("id").ilike("name", name).maybeSingle();
  if (dup) redirect(`/manager/orders/suppliers?s=${dup.id}&msg=${encodeURIComponent("This supplier already exists – opened it.")}`);
  const { data, error } = await sb
    .from("suppliers")
    .insert({
      name,
      contact_name: t("contact_name") || null,
      email,
      whatsapp,
      phone: t("phone") || whatsapp,
      website: t("website") || null,
      address: t("address") || null,
      specialties: validTypes(fd.getAll("specialties")),
      preferred_channel: pref,
      lead_time_days: Math.max(0, Number(t("lead_time_days")) || 3),
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/manager/orders/suppliers?new=1&msg=" + encodeURIComponent(`Could not save: ${error?.message ?? "unknown error"}`));
  revalidatePath("/manager/orders/suppliers");
  redirect(`/manager/orders/suppliers?s=${data.id}&msg=${encodeURIComponent(`${name} added. Now add the products you need.`)}`);
}

/** Adds every product that is running low and normally ordered from this supplier. */
export async function refillFillLow(fd: FormData) {
  const user = await assertStaff(MANAGER_ROLES);
  const supplierId = Number(fd.get("supplier_id"));
  const sb = supabaseAdmin();
  const { data: low } = await sb.from("products").select("id, stock, reorder_point, reorder_qty, cost_price").eq("supplier_id", supplierId).eq("status", "active");
  const need = (low ?? []).filter((p) => (p.stock ?? 0) <= (p.reorder_point ?? 0));
  if (!need.length) refillBack(fd, "Nothing from this supplier is running low right now.");
  const poId = await draftFor(supplierId, user.id);
  const { data: has } = await sb.from("purchase_order_items").select("product_id").eq("purchase_order_id", poId);
  const already = new Set((has ?? []).map((h) => h.product_id));
  const rows = need
    .filter((p) => !already.has(p.id))
    .map((p) => ({ purchase_order_id: poId, product_id: p.id, qty: Math.max(1, (p.reorder_qty || 0) + (p.reorder_point || 0) - (p.stock || 0)), unit_cost: p.cost_price }));
  if (rows.length) await sb.from("purchase_order_items").insert(rows);
  revalidatePath("/manager/orders/suppliers");
  refillBack(fd, rows.length ? `${rows.length} products added that are running low.` : "Everything running low is already on the list.");
}

/** Copies the last order sent to this supplier onto the open list. */
export async function refillRepeatLast(fd: FormData) {
  const user = await assertStaff(MANAGER_ROLES);
  const supplierId = Number(fd.get("supplier_id"));
  const sb = supabaseAdmin();
  const { data: last } = await sb
    .from("purchase_orders")
    .select("id, purchase_order_items(product_id, qty, unit_cost)")
    .eq("supplier_id", supplierId)
    .neq("status", "draft")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const items = (last?.purchase_order_items ?? []) as { product_id: number; qty: number; unit_cost: number | null }[];
  if (!items.length) refillBack(fd, "There is no earlier order to this supplier yet.");
  const poId = await draftFor(supplierId, user.id);
  const { data: has } = await sb.from("purchase_order_items").select("product_id").eq("purchase_order_id", poId);
  const already = new Set((has ?? []).map((h) => h.product_id));
  const rows = items.filter((i) => !already.has(i.product_id)).map((i) => ({ purchase_order_id: poId, product_id: i.product_id, qty: i.qty, unit_cost: i.unit_cost }));
  if (rows.length) await sb.from("purchase_order_items").insert(rows);
  revalidatePath("/manager/orders/suppliers");
  refillBack(fd, `Last order copied: ${rows.length} products added.`);
}
