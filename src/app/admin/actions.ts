"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { draftRefillOrders, receivePo, renderPoPdf, sendPo } from "@/lib/purchasing";
import { sendEmail } from "@/lib/notify";
import { siteUrl } from "@/lib/site";
import { cancelDhlLabel, createDhlLabel, dhlTrackingUrl } from "@/lib/dhl";
import { createClient } from "@supabase/supabase-js";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

// ---------- auth ----------
export async function signIn(_: unknown, fd: FormData) {
  const sb = await supabaseServer();
  const email = String(fd.get("email"));
  const password = String(fd.get("password") ?? "");
  if (password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: "Wrong email or password." };
    redirect("/admin");
  }
  // Implicit flow: the session travels inside the email link, so it can be opened on any device.
  const mailer = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await mailer.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/admin/auth/confirm`, shouldCreateUser: false },
  });
  if (error) {
    if (error.status === 429) return { error: "Too many sign-in emails in a short time. Please wait a few minutes and try again." };
    return { error: error.message };
  }
  return { ok: "Check your inbox for a sign-in link." };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/admin/login");
}

// ---------- products & stock ----------
export async function updateProduct(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "title_de", "brand", "description", "description_de", "image_url", "status", "country"]) if (fd.has(k)) patch[k] = str(fd.get(k));
  for (const k of ["price", "compare_at_price", "cost_price", "tax_rate", "weight_g", "reorder_point", "reorder_qty", "category_id", "supplier_id"])
    if (fd.has(k)) patch[k] = num(fd.get(k));
  for (const k of ["is_frozen", "age_restricted", "is_dropship", "featured"]) if (fd.has(`${k}__present`)) patch[k] = fd.get(k) === "on";
  if (fd.has("also_countries"))
    patch.also_countries = String(fd.get("also_countries") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (patch.image_url) patch.images = [patch.image_url];
  const { error } = await supabaseAdmin().from("products").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("catalog");
  revalidatePath(`/admin/products/${id}`);
}

export async function adjustStock(fd: FormData) {
  const user = await assertStaff();
  const product_id = Number(fd.get("product_id"));
  const mode = String(fd.get("mode")); // receive | adjust | count | damage | expired | spoiled
  const qty = Number(fd.get("qty"));
  const cost = num(String(fd.get("cost") ?? "").replace(",", ".") || null);
  const sb = supabaseAdmin();
  if (!Number.isFinite(qty)) throw new Error("Enter a quantity");

  if (mode === "receive") {
    if (qty <= 0) throw new Error("Received quantity must be positive");
    const { data: b } = await sb
      .from("stock_batches")
      .insert({ product_id, quantity_received: qty, quantity_left: qty, best_before: str(fd.get("best_before")), lot_code: str(fd.get("lot")), cost_price: cost })
      .select("id")
      .single();
    await sb.from("stock_movements").insert({ product_id, batch_id: b?.id, qty_change: qty, reason: "purchase", unit_cost: cost, note: str(fd.get("note")), created_by: user.id });
    if (cost !== null) {
      const { getPricingSettings, applyRecommended } = await import("@/lib/pricing");
      if ((await getPricingSettings()).autoApply) await applyRecommended([product_id], user.id, "auto (delivery)");
    }
  } else if (mode === "count") {
    const { data: p } = await sb.from("products").select("stock").eq("id", product_id).single();
    const diff = qty - (p?.stock ?? 0);
    if (diff !== 0) await sb.from("stock_movements").insert({ product_id, qty_change: diff, reason: "adjustment", note: "Stock count", created_by: user.id });
  } else {
    if (qty === 0) return;
    const loss = ["damage", "expired", "spoiled", "theft", "own_use"].includes(mode);
    await sb.from("stock_movements").insert({
      product_id,
      qty_change: loss ? -Math.abs(qty) : qty,
      reason: loss ? mode : "adjustment",
      note: str(fd.get("note")),
      created_by: user.id,
    });
  }
  revalidateTag("catalog");
  revalidatePath(`/admin/products/${product_id}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/finance");
}

// ---------- suppliers ----------
export async function saveSupplier(fd: FormData) {
  await assertStaff();
  const id = num(fd.get("id"));
  const row = {
    name: String(fd.get("name")),
    contact_name: str(fd.get("contact_name")),
    email: str(fd.get("email")),
    phone: str(fd.get("phone")),
    whatsapp: str(fd.get("whatsapp")),
    preferred_channel: String(fd.get("preferred_channel") ?? "email"),
    lead_time_days: Number(fd.get("lead_time_days") ?? 3),
    min_order_value: Number(fd.get("min_order_value") ?? 0),
    address: str(fd.get("address")),
    is_dropshipper: fd.get("is_dropshipper") === "on",
    notes: str(fd.get("notes")),
  };
  const sb = supabaseAdmin();
  if (id) await sb.from("suppliers").update(row).eq("id", id);
  else await sb.from("suppliers").insert(row);
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers");
}

export async function assignSupplier(fd: FormData) {
  await assertStaff();
  const supplier_id = Number(fd.get("supplier_id"));
  const product_id = Number(fd.get("product_id"));
  const sb = supabaseAdmin();
  await sb.from("supplier_products").update({ is_preferred: false }).eq("product_id", product_id);
  await sb.from("supplier_products").upsert({
    supplier_id,
    product_id,
    supplier_sku: str(fd.get("supplier_sku")),
    cost_price: num(fd.get("cost_price")),
    is_preferred: true,
  });
  await sb.from("products").update({ supplier_id }).eq("id", product_id);
  revalidatePath(`/admin/products/${product_id}`);
}

/** Assign one supplier to every product in a category (fast initial setup). */
export async function assignSupplierToCategory(fd: FormData) {
  await assertStaff();
  const supplier_id = Number(fd.get("supplier_id"));
  const category_id = Number(fd.get("category_id"));
  const sb = supabaseAdmin();
  const { data: cats } = await sb.from("categories").select("id").or(`id.eq.${category_id},parent_id.eq.${category_id}`);
  const ids = (cats ?? []).map((c) => c.id);
  const { data: prods } = await sb.from("products").select("id").in("category_id", ids);
  for (const p of prods ?? []) {
    await sb.from("supplier_products").update({ is_preferred: false }).eq("product_id", p.id);
    await sb.from("supplier_products").upsert({ supplier_id, product_id: p.id, is_preferred: true });
  }
  await sb.from("products").update({ supplier_id }).in("category_id", ids);
  revalidatePath("/admin/suppliers");
}

// ---------- purchase orders ----------
export async function createDrafts() {
  const user = await assertStaff();
  await draftRefillOrders(user.id);
  revalidatePath("/admin/purchase-orders");
}

export async function createManualPo(fd: FormData) {
  const user = await assertStaff();
  const { data } = await supabaseAdmin()
    .from("purchase_orders")
    .insert({ supplier_id: Number(fd.get("supplier_id")), created_by: user.id, notes: str(fd.get("notes")) })
    .select("id")
    .single();
  redirect(`/admin/purchase-orders/${data!.id}`);
}

export async function addPoItem(fd: FormData) {
  await assertStaff();
  const po = Number(fd.get("po_id"));
  const sb = supabaseAdmin();
  const sku = String(fd.get("sku")).trim();
  const { data: p } = await sb.from("products").select("id, cost_price").eq("sku", sku).maybeSingle();
  if (!p) throw new Error(`No product with SKU ${sku}`);
  await sb.from("purchase_order_items").insert({ purchase_order_id: po, product_id: p.id, qty: Number(fd.get("qty") ?? 1), unit_cost: p.cost_price });
  revalidatePath(`/admin/purchase-orders/${po}`);
}

export async function updatePoItem(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("item_id"));
  const qty = Number(fd.get("qty"));
  const sb = supabaseAdmin();
  if (qty <= 0) await sb.from("purchase_order_items").delete().eq("id", id);
  else await sb.from("purchase_order_items").update({ qty, unit_cost: num(fd.get("unit_cost")) }).eq("id", id);
  revalidatePath(`/admin/purchase-orders/${fd.get("po_id")}`);
}

export async function sendPoAction(_: unknown, fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("po_id"));
  const channel = String(fd.get("channel")) as "email" | "whatsapp";
  try {
    const r = await sendPo(id, channel);
    revalidatePath(`/admin/purchase-orders/${id}`);
    if (channel === "email") revalidatePath("/manager/orders/suppliers");
    if (!r.ok) return { error: r.error ?? "Sending failed" };
    if (r.link) return { link: r.link, pdfUrl: r.pdfUrl };
    return { ok: channel === "email" ? "Emailed to supplier with the PDF attached." : "Sent on WhatsApp.", pdfUrl: r.pdfUrl };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function markPoSent(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("po_id"));
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("status, pdf_path, suppliers(whatsapp, phone)").eq("id", id).single();
  await sb.from("purchase_orders").update({ status: po?.status === "draft" ? "sent" : po?.status, sent_via: "whatsapp", sent_at: new Date().toISOString(), edited_after_send: false }).eq("id", id);
  const sup = po?.suppliers as unknown as { whatsapp: string | null; phone: string | null } | null;
  await sb.from("purchase_order_sends").insert({ purchase_order_id: id, channel: "whatsapp", recipient: sup?.whatsapp ?? sup?.phone ?? null, pdf_path: po?.pdf_path ?? null });
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath("/manager/orders/suppliers");
}

export async function setPoStatus(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("po_id"));
  await supabaseAdmin().from("purchase_orders").update({ status: String(fd.get("status")) }).eq("id", id);
  revalidatePath(`/admin/purchase-orders/${id}`);
}

export async function receivePoAction(fd: FormData) {
  const user = await assertStaff();
  const id = Number(fd.get("po_id"));
  const lines: { product_id: number; qty: number; best_before?: string | null }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^recv_(\d+)$/);
    if (m) lines.push({ product_id: Number(m[1]), qty: Number(v || 0), best_before: str(fd.get(`bb_${m[1]}`)) });
  }
  await receivePo(id, lines, user.id);
  revalidateTag("catalog");
  revalidatePath(`/admin/purchase-orders/${id}`);
}

export async function regeneratePdf(fd: FormData) {
  await assertStaff();
  const { url } = await renderPoPdf(Number(fd.get("po_id")));
  redirect(url);
}

// ---------- orders ----------
export async function setOrderStatus(fd: FormData) {
  await assertStaff();
  const id = String(fd.get("order_id"));
  const status = String(fd.get("status"));
  const sb = supabaseAdmin();
  const { data: cur } = await sb.from("orders").select("tracking_number, carrier").eq("id", id).single();
  const tracking = str(fd.get("tracking_number")) || cur?.tracking_number || "";
  const patch: Record<string, unknown> = { status };
  if (tracking) patch.tracking_number = tracking;
  if (status === "delivered") patch.paid_at = new Date().toISOString();
  await sb.from("orders").update(patch).eq("id", id);
  if (fd.get("notify") === "on") {
    const { data: o } = await sb.from("orders").select("email, number, pickup_slot, balance_due, shipping_methods(carrier, tracking_url)").eq("id", id).single();
    const sm = (o?.shipping_methods ?? null) as unknown as { carrier: string | null; tracking_url: string | null } | null;
    const isDhl = String(cur?.carrier ?? "").startsWith("DHL");
    const link = tracking ? (isDhl ? dhlTrackingUrl(tracking) : sm?.tracking_url ? sm.tracking_url.replace("{tracking}", encodeURIComponent(tracking)) : null) : null;
    const msg: Record<string, string> = {
      shipped: `Your order #${o?.number} is on its way${isDhl ? " with DHL" : sm?.carrier ? ` with ${sm.carrier}` : ""}.${tracking ? ` Tracking number: ${link ? `<a href="${link}">${tracking}</a>` : tracking}` : ""}`,
      ready_for_pickup: `Your order #${o?.number} is ready for pickup${o?.pickup_slot ? ` (${o.pickup_slot})` : ""}.${Number(o?.balance_due) > 0 ? ` Amount to pay on collection: ${Number(o?.balance_due).toFixed(2).replace(".", ",")} €.` : ""}`,
      delivered: `Your order #${o?.number} was delivered. Enjoy!`,
      cancelled: `Your order #${o?.number} was cancelled. Contact us if you have questions.`,
    };
    if (o && msg[status]) await sendEmail({ to: o.email, subject: `Order #${o.number}: update`, html: `<p>${msg[status]}</p>` });
  }
  revalidatePath(`/admin/orders/${id}`);
}

export async function resolveAlert(fd: FormData) {
  await assertStaff();
  await supabaseAdmin().from("alerts").update({ resolved: true }).eq("id", Number(fd.get("id")));
  revalidatePath("/admin");
}

export async function saveStoreSettings(fd: FormData) {
  await assertStaff();
  const value = Object.fromEntries(["name", "street", "postal", "city", "phone", "whatsapp", "email", "vat_id", "owner"].map((k) => [k, String(fd.get(k) ?? "")]));
  await supabaseAdmin().from("settings").upsert({ key: "public.store", value });
  revalidatePath("/admin/settings");
}

// ---------- own password (so signing in doesn't depend on email) ----------
export async function setOwnPassword(_: unknown, fd: FormData) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "Please sign in again." };
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 10) return { error: "Use at least 10 characters." };
  if (pw !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: "Password saved. Next time, sign in with your email and this password." };
}

// ---------- payments received outside the online checkout ----------
/** Bank transfer arrived, or the rest was paid on collection. */
export async function markOrderPaid(fd: FormData) {
  await assertStaff();
  const id = String(fd.get("order_id"));
  const what = String(fd.get("what")); // full | balance
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("status, payment_method").eq("id", id).single();
  if (!o) return;
  if (o.status === "pending") {
    // reserves stock, books the sale and marks it paid (same as an online payment)
    await sb.rpc("mark_order_paid", { p_order_id: id, p_provider: o.payment_method === "bank" ? "bank" : "cash", p_ref: what === "full" ? "manual" : "collected" });
  }
  await sb.from("orders").update({ balance_due: 0, paid_at: new Date().toISOString(), ...(o.status === "processing" ? { status: "paid" } : {}) }).eq("id", id);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

// ---------- DHL labels ----------
export async function createLabelAction(fd: FormData) {
  await assertStaff();
  const id = String(fd.get("order_id"));
  const back = String(fd.get("back") || `/admin/orders/${id}`);
  let msg: string;
  try {
    const r = await createDhlLabel(id);
    msg = `DHL label created – tracking number ${r.shipmentNo}.`;
  } catch (e) {
    msg = `DHL: ${(e as Error).message}`;
  }
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/manager/orders");
  redirect(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}

export async function cancelLabelAction(fd: FormData) {
  await assertStaff();
  const id = String(fd.get("order_id"));
  let msg = "DHL label cancelled.";
  try {
    await cancelDhlLabel(id);
  } catch (e) {
    msg = `DHL: ${(e as Error).message}`;
  }
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?msg=${encodeURIComponent(msg)}`);
}
