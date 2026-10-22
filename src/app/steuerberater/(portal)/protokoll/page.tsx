import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { deDate } from "../toolbar";

export const metadata = { title: { absolute: "Änderungsprotokoll – Kanzlei-Zugang" } };

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
      <div>
        <h1 className="display text-2xl font-bold">Änderungsprotokoll</h1>
        <p className="mt-1 text-muted">Jede Änderung am Kassenbuch mit Grund, Person und Zeitpunkt. Das Protokoll selbst kann niemand ändern oder löschen.</p>
      </div>
      <section aria-label="Änderungen" className="stb-sheet">
        <div className="max-h-[75vh] overflow-auto">
          <table className="stb-grid min-w-[60rem]">
            <thead>
              <tr><th>Zeitpunkt</th><th>Buchung</th><th>Buchungstext</th><th>Feld</th><th>Vorher</th><th>Nachher</th><th className="w-full">Grund</th><th>Von</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = r.cashbook_entries;
                const mm = e ? String(e.month).padStart(2, "0") : "";
                const no = e ? `${e.seq}-${mm}-${e.year}` : String(r.entry_id);
                return (
                  <tr key={r.id}>
                    <td><span>{new Date(r.changed_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span></td>
                    <td><Link href={e ? `/steuerberater?m=${e.year}-${mm}&e=${r.entry_id}` : "/steuerberater"} className="font-semibold text-forest underline">{no}</Link></td>
                    <td className="max-w-[14rem]"><span title={e?.text}>{e ? `${deDate(e.entry_date)} · ${e.text}` : ""}</span></td>
                    <td><span>{r.field}</span></td>
                    <td className="max-w-[12rem]"><span title={r.old_value ?? ""}>{r.old_value ?? "leer"}</span></td>
                    <td className="max-w-[12rem]"><span title={r.new_value ?? ""}>{r.new_value ?? "leer"}</span></td>
                    <td className="max-w-[18rem]"><span title={r.reason}>{r.reason}</span></td>
                    <td><span title={r.changed_by_email ?? ""}>{r.changed_by_email ?? ""}{r.changed_by_role === "admin" ? " (Inhaberin)" : ""}</span></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8}><span className="!py-6 text-center text-muted">Noch keine Änderungen.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
