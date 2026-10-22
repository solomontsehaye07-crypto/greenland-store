import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { Crumbs, deDate } from "../toolbar";

export const metadata = { title: { absolute: "Änderungsprotokoll – Steuerberater-Portal" } };

type Row = {
  id: number; entry_id: number; field: string; old_value: string | null; new_value: string | null; reason: string;
  changed_by_email: string | null; changed_by_role: string | null; changed_at: string;
  cashbook_entries: { seq: number; month: number; year: number; entry_date: string; text: string } | null;
};

// Every change to the cash book, newest first. The log itself can't be changed or deleted.
export default async function PortalLog() {
  const { data } = await supabaseAdmin()
    .from("cashbook_changes")
    .select("id, entry_id, field, old_value, new_value, reason, changed_by_email, changed_by_role, changed_at, cashbook_entries(seq, month, year, entry_date, text)")
    .order("changed_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <Crumbs a="Kassenbuch Laden" b="Änderungsprotokoll" />
      <p className="px-2 py-1.5 text-[#666]">{rows.length} Einträge · jede Änderung mit Grund, Person und Zeitpunkt · das Protokoll kann nicht geändert oder gelöscht werden</p>
      <div className="mx-2 mb-2 max-h-[75vh] overflow-auto border border-[#c3c3c3]">
        <table className="stb-grid min-w-[62rem]">
          <thead>
            <tr><th>Zeitpunkt</th><th>Buchung</th><th>Datum</th><th>Buchungstext</th><th>Feld</th><th>Alter Wert</th><th>Neuer Wert</th><th className="w-full">Grund</th><th>Geändert von</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = r.cashbook_entries;
              const no = e ? `${e.seq}-${String(e.month).padStart(2, "0")}-${e.year}` : String(r.entry_id);
              const href = e ? `/steuerberater?m=${e.year}-${String(e.month).padStart(2, "0")}&e=${r.entry_id}#bearbeiten` : "/steuerberater";
              return (
                <tr key={r.id}>
                  <td><span>{new Date(r.changed_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span></td>
                  <td><Link href={href} className="underline">{no}</Link></td>
                  <td><span>{e ? deDate(e.entry_date) : ""}</span></td>
                  <td className="max-w-[14rem]"><span title={e?.text}>{e?.text}</span></td>
                  <td><span>{r.field}</span></td>
                  <td className="max-w-[12rem]"><span title={r.old_value ?? ""}>{r.old_value ?? "–"}</span></td>
                  <td className="max-w-[12rem]"><span title={r.new_value ?? ""}>{r.new_value ?? "–"}</span></td>
                  <td className="max-w-[18rem]"><span title={r.reason}>{r.reason}</span></td>
                  <td><span title={r.changed_by_email ?? ""}>{r.changed_by_email ?? ""}{r.changed_by_role === "admin" ? " (Inhaberin)" : ""}</span></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={9}><span className="!py-4 text-center text-[#666]">Noch keine Änderungen.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
