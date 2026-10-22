"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdvisor } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Steuerberater portal: two kinds of change, both with a reason and both logged.
//  1. Kontierung (BU, Gegenkonto, USt %, Notiz) – changed in place via cashbook_classify, old/new value logged.
//  2. Korrektur of amount/text – the line itself stays; a Storno line plus a corrected line are booked (GoBD).

const txt = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const dec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!s) return null;
  const x = Number(s);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : NaN;
};
const pad = (n: number) => String(n).padStart(2, "0");

function back(m: string, e: number | null, msg: string, err = false): never {
  const q = new URLSearchParams({ m });
  if (e) q.set("e", String(e));
  q.set(err ? "err" : "msg", msg);
  redirect(`/steuerberater?${q}#bearbeiten`);
}

async function who() {
  try {
    const { user, role } = await assertAdvisor();
    return { id: user.id, email: user.email ?? "", role };
  } catch {
    redirect("/steuerberater/login");
  }
}

export async function classifyEntry(fd: FormData) {
  const u = await who();
  const id = Number(fd.get("id"));
  const m = txt(fd.get("m"), 7);
  const reason = txt(fd.get("reason"), 300);
  if (reason.length < 3) back(m, id, "Bitte einen Grund für die Änderung angeben.", true);
  const bu = txt(fd.get("bu"), 4);
  const contra = txt(fd.get("contra"), 9);
  if (contra && !/^\d{1,9}$/.test(contra)) back(m, id, "Das Gegenkonto darf nur Ziffern enthalten.", true);
  if (bu && !/^\d{1,4}$/.test(bu)) back(m, id, "Der BU-Schlüssel darf nur Ziffern enthalten.", true);
  const vat = dec(fd.get("vat"));
  if (Number.isNaN(vat) || (vat != null && (vat < 0 || vat > 99))) back(m, id, "Bitte einen gültigen USt-Satz eingeben (z. B. 7 oder 19).", true);
  const { data: n, error } = await supabaseAdmin().rpc("cashbook_classify", {
    p_id: id,
    p_bu: bu,
    p_contra: contra,
    p_vat: vat,
    p_note: txt(fd.get("note"), 300),
    p_reason: reason,
    p_user: u.id,
    p_email: u.email,
    p_role: u.role,
  });
  if (error) back(m, id, error.message, true);
  revalidatePath("/steuerberater");
  revalidatePath("/admin/buchhaltung");
  back(m, id, n ? `Gespeichert – ${n} ${n === 1 ? "Feld" : "Felder"} geändert und protokolliert.` : "Keine Änderung – die Werte waren bereits so.");
}

/** Wrong amount or text: Storno of the line and a new, corrected line – both today, with the reason. */
export async function correctEntry(fd: FormData) {
  const u = await who();
  const id = Number(fd.get("id"));
  const m = txt(fd.get("m"), 7);
  const reason = txt(fd.get("reason"), 300);
  if (reason.length < 3) back(m, id, "Bitte einen Grund für die Korrektur angeben.", true);
  const sb = supabaseAdmin();
  const { data: e } = await sb.from("cashbook_entries").select("*").eq("id", id).maybeSingle();
  if (!e) back(m, null, "Buchung nicht gefunden.", true);
  if (e.storno_of) back(m, id, "Eine Stornobuchung kann nicht erneut korrigiert werden.", true);
  const { data: again } = await sb.from("cashbook_entries").select("id").eq("storno_of", id).maybeSingle();
  if (again) back(m, id, "Diese Buchung wurde bereits storniert.", true);

  const amount = dec(fd.get("amount"));
  const side = fd.get("side") === "out" ? "out" : "in";
  const text = txt(fd.get("text"), 200);
  const onlyStorno = fd.get("only_storno") === "on";
  if (!onlyStorno && (amount == null || Number.isNaN(amount) || amount <= 0)) back(m, id, "Bitte den richtigen Betrag eingeben.", true);
  if (!onlyStorno && !text) back(m, id, "Bitte den Buchungstext eingeben.", true);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const orig = `${e.seq}-${pad(e.month)}-${e.year}`;
  const st = await sb.rpc("cashbook_add", {
    p_date: today,
    p_income: Number(e.expense),
    p_expense: Number(e.income),
    p_text: `Storno: ${e.text}`.slice(0, 200),
    p_bu: e.bu ?? "",
    p_contra: e.contra_account ?? "",
    p_vat: e.vat_rate,
    p_note: `Storno zu ${orig} – ${reason}`.slice(0, 300),
    p_storno_of: id,
    p_user: u.id,
  });
  if (st.error) back(m, id, st.error.message, true);
  let newLine = "";
  if (!onlyStorno) {
    const nw = await sb.rpc("cashbook_add", {
      p_date: today,
      p_income: side === "in" ? amount : 0,
      p_expense: side === "out" ? amount : 0,
      p_text: text,
      p_bu: e.bu ?? "",
      p_contra: e.contra_account ?? "",
      p_vat: e.vat_rate,
      p_note: `Korrektur zu ${orig} – ${reason}`.slice(0, 300),
      p_storno_of: null,
      p_user: u.id,
    });
    if (nw.error) back(m, id, `Storno gebucht, aber die neue Buchung schlug fehl: ${nw.error.message}`, true);
    newLine = ` und neu gebucht (${side === "in" ? "Einnahme" : "Ausgabe"} ${String(amount).replace(".", ",")} €)`;
  }
  const old = `${Number(e.income) ? `Einnahme ${e.income}` : `Ausgabe ${e.expense}`} · ${e.text}`;
  const nv = onlyStorno ? "storniert" : `${side === "in" ? "Einnahme" : "Ausgabe"} ${amount} · ${text}`;
  await sb.from("cashbook_changes").insert({ entry_id: id, field: "Korrektur", old_value: old, new_value: nv, reason, changed_by: u.id, changed_by_email: u.email, changed_by_role: u.role });
  revalidatePath("/steuerberater");
  revalidatePath("/admin/buchhaltung");
  back(today.slice(0, 7), null, `Buchung ${orig} storniert${newLine}.`);
}
