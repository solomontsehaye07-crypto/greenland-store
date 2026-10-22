"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_ACCOUNTING, getShopMonth, parseMonth } from "@/lib/cashbook";

// Cash book actions – admins only. Lines are append-only (the database refuses changes);
// a wrong line is corrected with a counter-entry ("Storno").

const BASE = "/admin/buchhaltung/kasse";
const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s) return 0;
  const x = Number(s);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : NaN;
};
const txt = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

/** Database messages are German (they also protect direct access); show them in English here. */
function english(msg: string) {
  if (/negativ/.test(msg)) return `The cash balance would go below zero (${msg.match(/\((-?[\d.]+)/)?.[1] ?? ""} €). Check the order and the amounts.`;
  if (/abgeschlossen/.test(msg)) return "This month is closed – no more entries can be added.";
  if (/nicht geändert oder gelöscht/.test(msg)) return "Entries can't be changed or deleted – book a reversal instead.";
  return msg;
}

function back(month: string, msg: string, err = false): never {
  msg = english(msg);
  redirect(`${BASE}?m=${month}&${err ? "err" : "msg"}=${encodeURIComponent(msg)}`);
}

export async function addEntry(fd: FormData) {
  const user = await assertStaff(["admin"]);
  const date = txt(fd.get("date"), 10);
  const month = date.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(txt(fd.get("m"), 7), "Please choose a date.", true);
  if (date > new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })) back(month, "Entries can't be dated in the future.", true);
  const income = dec(fd.get("income"));
  const expense = dec(fd.get("expense"));
  if (Number.isNaN(income) || Number.isNaN(expense)) back(month, "Please enter a valid amount, e.g. 49,50.", true);
  if ((income > 0) === (expense > 0)) back(month, "Enter either money in or money out – not both.", true);
  const text = txt(fd.get("text"));
  if (!text) back(month, "Please enter a booking text.", true);
  const vatRaw = txt(fd.get("vat"), 5).replace(",", ".");
  const vat = vatRaw === "" ? null : Number(vatRaw);
  const { error } = await supabaseAdmin().rpc("cashbook_add", {
    p_date: date,
    p_income: income,
    p_expense: expense,
    p_text: text,
    p_bu: txt(fd.get("bu"), 4),
    p_contra: txt(fd.get("contra"), 9),
    p_vat: Number.isFinite(vat) ? vat : null,
    p_note: txt(fd.get("note"), 300),
    p_storno_of: null,
    p_user: user.id,
  });
  if (error) back(month, error.message, true);
  if (fd.get("save_template") === "on") {
    await supabaseAdmin().from("cashbook_templates").insert({ text, kind: income > 0 ? "in" : "out", bu: txt(fd.get("bu"), 4) || null, contra_account: txt(fd.get("contra"), 9) || null, vat_rate: Number.isFinite(vat) ? vat : null, sort: 50 });
  }
  revalidatePath("/admin/buchhaltung");
  back(month, "Saved.");
}

/** Books the exact opposite of a line, dated today (or in its own month if that is still open and today is later). */
export async function stornoEntry(fd: FormData) {
  const user = await assertStaff(["admin"]);
  const id = Number(fd.get("id"));
  const m = txt(fd.get("m"), 7);
  const sb = supabaseAdmin();
  const { data: e } = await sb.from("cashbook_entries").select("*").eq("id", id).maybeSingle();
  if (!e) back(m, "Entry not found.", true);
  const { data: again } = await sb.from("cashbook_entries").select("id").eq("storno_of", id).maybeSingle();
  if (again) back(m, "This entry has already been reversed.", true);
  if (e.storno_of) back(m, "A reversal can't be reversed again.", true);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const { error } = await sb.rpc("cashbook_add", {
    p_date: today,
    p_income: Number(e.expense),
    p_expense: Number(e.income),
    p_text: `Storno: ${e.text}`.slice(0, 200),
    p_bu: e.bu ?? "",
    p_contra: e.contra_account ?? "",
    p_vat: e.vat_rate,
    p_note: txt(fd.get("reason"), 300) || `Storno zu ${e.seq}-${String(e.month).padStart(2, "0")}-${e.year}`,
    p_storno_of: id,
    p_user: user.id,
  });
  if (error) back(m, error.message, true);
  revalidatePath("/admin/buchhaltung");
  back(today.slice(0, 7), "Reversal booked.");
}

/** The opening balance can only be set while a month has no lines yet (e.g. when starting with the book). */
export async function setOpening(fd: FormData) {
  await assertStaff(["admin"]);
  const { year, month } = parseMonth(txt(fd.get("m"), 7));
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const value = dec(fd.get("opening"));
  if (Number.isNaN(value) || value < 0) back(key, "Please enter a valid opening balance.", true);
  const sb = supabaseAdmin();
  const { count } = await sb.from("cashbook_entries").select("id", { count: "exact", head: true }).eq("year", year).eq("month", month);
  if (count) back(key, "The opening balance can only be changed while the month has no entries.", true);
  const { error } = await sb.from("cashbook_months").upsert({ year, month, opening_balance: value }, { onConflict: "year,month" });
  if (error) back(key, error.message, true);
  revalidatePath("/admin/buchhaltung");
  back(key, "Opening balance saved.");
}

export async function closeMonth(fd: FormData) {
  const user = await assertStaff(["admin"]);
  const { year, month } = parseMonth(txt(fd.get("m"), 7));
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  if (key >= today.slice(0, 7)) back(key, "A month can only be closed after it has ended.", true);
  const m = await getShopMonth(year, month);
  const sb = supabaseAdmin();
  const { error } = await sb.from("cashbook_months").upsert({ year, month, opening_balance: m.opening, closed_at: new Date().toISOString(), closed_by: user.id }, { onConflict: "year,month" });
  if (error) back(key, error.message, true);
  revalidatePath("/admin/buchhaltung");
  back(key, "Month closed. No more entries can be added to it.");
}

export async function saveTemplate(fd: FormData) {
  await assertStaff(["admin"]);
  const m = txt(fd.get("m"), 7);
  const id = Number(fd.get("id")) || null;
  const row = {
    text: txt(fd.get("text")),
    kind: fd.get("kind") === "in" ? "in" : "out",
    bu: txt(fd.get("bu"), 4) || null,
    contra_account: txt(fd.get("contra"), 9) || null,
    vat_rate: txt(fd.get("vat"), 5) ? Number(txt(fd.get("vat"), 5).replace(",", ".")) : null,
  };
  if (!row.text) back(m, "Please enter a text for the template.", true);
  const sb = supabaseAdmin();
  const { error } = id ? await sb.from("cashbook_templates").update(row).eq("id", id) : await sb.from("cashbook_templates").insert({ ...row, sort: 50 });
  if (error) back(m, error.message, true);
  back(m, "Template saved.");
}

export async function deleteTemplate(fd: FormData) {
  await assertStaff(["admin"]);
  await supabaseAdmin().from("cashbook_templates").delete().eq("id", Number(fd.get("id")));
  back(txt(fd.get("m"), 7), "Template deleted.");
}

export async function saveAccounting(fd: FormData) {
  await assertStaff(["admin"]);
  const digits = (k: string, max = 9) => txt(fd.get(k), max).replace(/\D/g, "");
  const value = {
    consultant: digits("consultant", 7),
    client: digits("client", 5),
    chart: fd.get("chart") === "SKR04" ? "SKR04" : "SKR03",
    cashAccount: digits("cashAccount") || DEFAULT_ACCOUNTING.cashAccount,
    revenue7: digits("revenue7") || DEFAULT_ACCOUNTING.revenue7,
    revenue19: digits("revenue19") || DEFAULT_ACCOUNTING.revenue19,
    transitAccount: digits("transitAccount") || DEFAULT_ACCOUNTING.transitAccount,
    feeAccount: digits("feeAccount") || DEFAULT_ACCOUNTING.feeAccount,
  };
  const { error } = await supabaseAdmin().from("settings").upsert({ key: "private.accounting", value }, { onConflict: "key" });
  const m = txt(fd.get("m"), 7);
  redirect(`/admin/buchhaltung?m=${m}&${error ? "err" : "msg"}=${encodeURIComponent(error ? error.message : "Settings saved.")}`);
}

// ---------- Steuerberater access (separate portal at /steuerberater) ----------

const toBook = (msg: string, err = false): never => redirect(`/admin/buchhaltung?${err ? "err" : "msg"}=${encodeURIComponent(msg)}#steuerberater`);

/** Gives an email address access to the Steuerberater portal only (no shop admin). Sign-in is by email code. */
export async function addAdvisor(fd: FormData) {
  const me = await assertStaff(["admin"]);
  const email = txt(fd.get("email"), 200).toLowerCase();
  const name = txt(fd.get("name"), 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) toBook("Please enter a valid email address.", true);
  const sb = supabaseAdmin();
  let id: string | null = null;
  const { data: made, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (made?.user) id = made.user.id;
  else {
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (!id) toBook(`Could not add the account: ${error?.message ?? "unknown error"}`, true);
  }
  if (id === me.id) toBook("That is your own account – you can already open the portal.", true);
  const { data: prof } = await sb.from("profiles").select("role").eq("id", id!).maybeSingle();
  if (prof && ["staff", "manager", "admin"].includes(prof.role)) toBook(`${email} is a team member (${prof.role}). Use a separate email for the Steuerberater, so the shop admin stays closed to them.`, true);
  const { error: e2 } = await sb.from("profiles").upsert({ id: id!, role: "tax_advisor", email, ...(name ? { full_name: name } : {}) }, { onConflict: "id" });
  if (e2) toBook(e2.message, true);
  revalidatePath("/admin/buchhaltung");
  toBook(`${email} can now sign in at /steuerberater with an email code.`);
}

export async function removeAdvisor(fd: FormData) {
  await assertStaff(["admin"]);
  const id = txt(fd.get("id"), 64);
  const sb = supabaseAdmin();
  const { data: prof } = await sb.from("profiles").select("role").eq("id", id).maybeSingle();
  if (prof?.role !== "tax_advisor") toBook("This account is not a Steuerberater account.", true);
  await sb.from("profiles").update({ role: "customer" }).eq("id", id);
  // the portal checks the role on every page, so access ends immediately
  revalidatePath("/admin/buchhaltung");
  toBook("Access removed.");
}
