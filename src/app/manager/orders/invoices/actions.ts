"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getSeries, lineFromProduct, parseLastNumber, recalc } from "@/lib/invoices";

const BASE = "/manager/orders/invoices";
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = Number(t(fd, k).replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};
const go = (path: string, msg?: string): never => redirect(`${path}${msg ? `${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}` : ""}`);
const done = (id?: number) => {
  revalidatePath(BASE);
  if (id) revalidatePath(`${BASE}/${id}`);
};
async function draftOnly(id: number) {
  const { data } = await supabaseAdmin().from("invoices").select("status").eq("id", id).single();
  if (data?.status !== "draft") go(`${BASE}/${id}`, "This invoice is already issued and can't be changed.");
}

// ---------- customers ----------
export async function saveCustomer(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "id")) || 0;
  const name = t(fd, "name");
  if (!name) go(`${BASE}/customers${id ? `?id=${id}` : "?new=1"}`, "Please enter the company name.");
  const row = {
    name,
    contact_name: t(fd, "contact_name") || null,
    street: t(fd, "street") || null,
    postal: t(fd, "postal") || null,
    city: t(fd, "city") || null,
    country: (t(fd, "country") || "DE").toUpperCase().slice(0, 2),
    vat_id: t(fd, "vat_id") || null,
    email: t(fd, "email") || null,
    whatsapp: t(fd, "whatsapp") || null,
    phone: t(fd, "phone") || null,
    discount_pct: Math.min(99, Math.max(0, num(fd, "discount_pct") || 0)),
    payment_days: Math.min(365, Math.max(0, Math.round(num(fd, "payment_days")) || 14)),
    notes: t(fd, "notes") || null,
  };
  const sb = supabaseAdmin();
  const res = id ? await sb.from("business_customers").update(row).eq("id", id).select("id").single() : await sb.from("business_customers").insert(row).select("id").single();
  if (res.error) go(`${BASE}/customers${id ? `?id=${id}` : "?new=1"}`, res.error.message);
  done();
  const back = t(fd, "back");
  if (back === "new-invoice") return startInvoice(res.data!.id);
  go(`${BASE}/customers`, "Customer saved.");
}

// ---------- invoices ----------
async function startInvoice(customerId: number): Promise<never> {
  const user = await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const { data: c } = await sb.from("business_customers").select("*").eq("id", customerId).single();
  if (!c) go(`${BASE}/new`, "Customer not found.");
  const { data, error } = await sb
    .from("invoices")
    .insert({ customer_id: c!.id, payment_days: c!.payment_days, discount_pct: c!.discount_pct, created_by: user.id, delivery_date: new Date().toISOString().slice(0, 10) })
    .select("id")
    .single();
  if (error) go(`${BASE}/new`, error.message);
  done();
  return go(`${BASE}/${data!.id}`);
}

export async function newInvoice(fd: FormData) {
  await startInvoice(Number(t(fd, "customer_id")));
}

export async function addProductLine(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await draftOnly(id);
  const sb = supabaseAdmin();
  const { data: inv } = await sb.from("invoices").select("discount_pct").eq("id", id).single();
  const pid = Number(t(fd, "product_id"));
  const qty = Math.max(1, num(fd, "qty") || 1);
  const { data: has } = await sb.from("invoice_items").select("id, qty").eq("invoice_id", id).eq("product_id", pid).maybeSingle();
  if (has) await sb.from("invoice_items").update({ qty: Number(has.qty) + qty }).eq("id", has.id);
  else {
    const line = await lineFromProduct(pid, Number(inv?.discount_pct ?? 0));
    const { count } = await sb.from("invoice_items").select("id", { count: "exact", head: true }).eq("invoice_id", id);
    await sb.from("invoice_items").insert({ ...line, invoice_id: id, qty, position: (count ?? 0) + 1 });
  }
  await recalc(id);
  done(id);
  go(`${BASE}/${id}?q=${encodeURIComponent(t(fd, "q"))}`);
}

export async function addCustomLine(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await draftOnly(id);
  const title = t(fd, "title");
  const qty = num(fd, "qty");
  const unit = num(fd, "unit_net");
  const rate = num(fd, "tax_rate");
  if (!title || !(qty > 0) || !(unit >= 0)) go(`${BASE}/${id}`, "Please fill in description, quantity and price.");
  const sb = supabaseAdmin();
  const { count } = await sb.from("invoice_items").select("id", { count: "exact", head: true }).eq("invoice_id", id);
  await sb.from("invoice_items").insert({ invoice_id: id, title, qty, unit_net: unit, tax_rate: [0, 7, 19].includes(rate) ? rate : 19, position: (count ?? 0) + 1 });
  await recalc(id);
  done(id);
  go(`${BASE}/${id}`);
}

export async function updateLine(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await draftOnly(id);
  const itemId = Number(t(fd, "item_id"));
  const qty = num(fd, "qty");
  const unit = num(fd, "unit_net");
  const sb = supabaseAdmin();
  if (!(qty > 0)) await sb.from("invoice_items").delete().eq("id", itemId).eq("invoice_id", id);
  else await sb.from("invoice_items").update({ qty: Math.min(99999, qty), ...(unit >= 0 ? { unit_net: unit } : {}) }).eq("id", itemId).eq("invoice_id", id);
  await recalc(id);
  done(id);
  go(`${BASE}/${id}`);
}

export async function removeLine(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await draftOnly(id);
  await supabaseAdmin().from("invoice_items").delete().eq("id", Number(t(fd, "item_id"))).eq("invoice_id", id);
  await recalc(id);
  done(id);
  go(`${BASE}/${id}`);
}

export async function saveInvoiceDetails(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await draftOnly(id);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t(fd, k)) ? t(fd, k) : null);
  await supabaseAdmin()
    .from("invoices")
    .update({
      issue_date: date("issue_date"),
      delivery_date: date("delivery_date"),
      payment_days: Math.min(365, Math.max(0, Math.round(num(fd, "payment_days")) || 0)),
      notes: t(fd, "notes") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  done(id);
  go(`${BASE}/${id}`, "Saved.");
}

/** Gives the invoice its number, due date and takes the products out of stock. */
export async function issueInvoice(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  const sb = supabaseAdmin();
  const { data: inv } = await sb.from("invoices").select("status, business_customers(*)").eq("id", id).single();
  if (!inv) go(BASE, "Invoice not found.");
  if (inv!.status === "draft") {
    // keep a copy of the customer's details as they are today
    await sb.from("invoices").update({ customer: inv!.business_customers ?? {} }).eq("id", id);
    await recalc(id);
  }
  const { data: no, error } = await sb.rpc("issue_invoice", { p_id: id });
  if (error) go(`${BASE}/${id}`, error.message);
  done(id);
  go(`${BASE}/${id}`, `Invoice ${no} issued. Stock updated.`);
}

export async function markPaid(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(t(fd, "paid_at")) ? t(fd, "paid_at") : new Date().toISOString().slice(0, 10);
  const sb = supabaseAdmin();
  const { data: inv } = await sb.from("invoices").select("total, status").eq("id", id).single();
  if (inv?.status !== "open") go(`${BASE}/${id}`);
  const amount = num(fd, "paid_amount");
  const paid = amount > 0 ? amount : Number(inv!.total);
  const full = paid >= Number(inv!.total) - 0.005;
  await sb.from("invoices").update({ paid_amount: paid, paid_at: date, status: full ? "paid" : "open", updated_at: new Date().toISOString() }).eq("id", id);
  done(id);
  go(`${BASE}/${id}`, full ? "Marked as paid." : "Part payment saved – the rest is still open.");
}

export async function markUnpaid(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  await supabaseAdmin().from("invoices").update({ status: "open", paid_at: null, paid_amount: null }).eq("id", id).eq("status", "paid");
  done(id);
  go(`${BASE}/${id}`, "Marked as not paid.");
}

export async function cancelInvoice(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const id = Number(t(fd, "invoice_id"));
  const sb = supabaseAdmin();
  const { data: inv } = await sb.from("invoices").select("status").eq("id", id).single();
  if (inv?.status === "draft") {
    await sb.from("invoices").delete().eq("id", id).eq("status", "draft");
    done();
    go(BASE, "Draft deleted.");
  }
  const { error } = await sb.rpc("cancel_invoice", { p_id: id });
  if (error) go(`${BASE}/${id}`, error.message);
  done(id);
  go(`${BASE}/${id}`, "Invoice cancelled. The products are back in stock.");
}

/** Called after a reminder was shared, so the next one says "2. Zahlungserinnerung". */
export async function noteReminderSent(id: number) {
  await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const { data } = await sb.from("invoices").select("reminders").eq("id", id).single();
  await sb.from("invoices").update({ reminders: (data?.reminders ?? 0) + 1, last_reminder_at: new Date().toISOString() }).eq("id", id);
  done(id);
}

// ---------- numbering ----------
export async function saveSeries(fd: FormData) {
  await assertStaff(MANAGER_ROLES);
  const sb = supabaseAdmin();
  const cur = await getSeries();
  const last = t(fd, "last_number");
  const patch: Record<string, unknown> = {
    payment_days: Math.min(365, Math.max(0, Math.round(num(fd, "payment_days")) || 14)),
    footer: t(fd, "footer") || null,
  };
  if (last) {
    const p = parseLastNumber(last);
    if (!p) go(`${BASE}/settings`, "The last invoice number must end with digits, e.g. RE-2026-0147 or 1046.");
    const nextNo = `${p!.prefix}${String(p!.next_number).padStart(p!.pad, "0")}`;
    const { data: taken } = await sb.from("invoices").select("id").eq("number", nextNo).maybeSingle();
    if (taken) go(`${BASE}/settings`, `${nextNo} is already used by an invoice in this app.`);
    Object.assign(patch, p);
  }
  const { error } = await sb.from("invoice_series").update(patch).eq("id", 1);
  if (error) go(`${BASE}/settings`, error.message);
  void cur;
  done();
  go(`${BASE}/settings`, "Saved.");
}
