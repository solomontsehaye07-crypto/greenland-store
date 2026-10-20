"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { setOrderStatus, markOrderPaid } from "../admin/actions";
import { storeFrom } from "@/lib/designs";

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
