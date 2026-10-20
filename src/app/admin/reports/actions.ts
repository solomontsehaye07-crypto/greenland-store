"use server";

import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { buildReport, reportCsv } from "@/lib/reports";
import { buildReportPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/notify";
import { resolvePeriod } from "./period";

/** Emails the report (PDF + CSV files) to the tax advisor and remembers the address. */
export async function sendReport(fd: FormData) {
  await assertStaff();
  const to = String(fd.get("advisor") ?? "").trim();
  const per = resolvePeriod(String(fd.get("p") || "") || undefined, String(fd.get("from") || "") || undefined, String(fd.get("to") || "") || undefined);
  const back = (msg: string): never => redirect(`/admin/reports?p=${encodeURIComponent(per.key === "custom" ? "" : per.key)}${per.key === "custom" ? `&from=${per.from}&to=${per.to}` : ""}&msg=${encodeURIComponent(msg)}`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) back("Please enter the email address of your tax advisor.");
  const sb = supabaseAdmin();
  const { data: rows } = await sb.from("settings").select("key, value").in("key", ["public.store", "public.receipt"]);
  const get = (k: string) => ((rows ?? []).find((x) => x.key === k)?.value ?? {}) as Record<string, string>;
  const store: Record<string, string> = { ...get("public.store"), tax_number: get("public.receipt").tax_number ?? "" };
  await sb.from("settings").upsert({ key: "private.accounting", value: { advisorEmail: to } }, { onConflict: "key" });

  const r = await buildReport(per.from, per.to);
  const pdf = await buildReportPdf(r, store);
  const enc = new TextEncoder();
  const base = `Greenland-Bericht-${per.from}_${per.to}`;
  const res = await sendEmail({
    to,
    replyTo: store.email || undefined,
    subject: `Buchhaltung ${store.name || "Greenland Afro Asia Store"}: ${per.label}`,
    html: `<p>Guten Tag,</p><p>anbei die Unterlagen für ${per.label} (${per.from} bis ${per.to}): Bericht als PDF sowie Umsätze, Warenverluste, Wareneingang und Ausgaben als CSV.</p><p>Mit freundlichen Grüßen<br>${store.owner || store.name || ""}</p>`,
    attachments: [
      { filename: `${base}.pdf`, content: pdf },
      { filename: `${base}-Umsaetze.csv`, content: enc.encode(reportCsv(r, "sales")) },
      { filename: `${base}-Warenverluste.csv`, content: enc.encode(reportCsv(r, "losses")) },
      { filename: `${base}-Wareneingang.csv`, content: enc.encode(reportCsv(r, "purchases")) },
      { filename: `${base}-Ausgaben.csv`, content: enc.encode(reportCsv(r, "expenses")) },
    ],
  });
  if (!res.ok) back(`Could not send: ${res.error}`);
  back(`Report for ${per.label} sent to ${to}.`);
}
