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
      <section aria-label="Änderungen" className="stb-sheet overflow-hidden">
        <ol className="divide-y divide-line sm:hidden">
          {rows.map((r) => {
            const e = r.cashbook_entries;
            const mm = e ? String(e.month).padStart(2, "0") : "";
            return (
              <li key={r.id} className="px-4 py-3">
                <p><span className="font-semibold">{r.field}</span>: {r.old_value ?? "leer"} → {r.new_value ?? "leer"}</p>
                <p className="text-[13px]">„{r.reason}“</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {e ? <Link href={`/steuerberater?m=${e.year}-${mm}&e=${r.entry_id}`} className="font-semibold text-forest underline">{e.seq}-{mm}-{e.year}</Link> : r.entry_id} · {e?.text} · {new Date(r.changed_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} · {r.changed_by_role === "admin" ? "Inhaberin" : "Kanzlei"}
                </p>
              </li>
            );
          })}
          {!rows.length && <li className="px-4 py-6 text-center text-muted">Noch keine Änderungen.</li>}
        </ol>
        <div className="hidden max-h-[75dvh] overflow-auto sm:block">
          <table className="stb-grid min-w-[42rem] lg:min-w-[56rem]">
            <thead>
              <tr><th className="stick">Zeitpunkt</th><th>Buchung</th><th className="hidden lg:table-cell">Buchungstext</th><th>Feld</th><th>Vorher</th><th>Nachher</th><th className="w-full">Grund</th><th className="hidden lg:table-cell">Von</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = r.cashbook_entries;
                const mm = e ? String(e.month).padStart(2, "0") : "";
                const no = e ? `${e.seq}-${mm}-${e.year}` : String(r.entry_id);
                return (
                  <tr key={r.id}>
                    <td className="stick"><span>{new Date(r.changed_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span></td>
                    <td><Link href={e ? `/steuerberater?m=${e.year}-${mm}&e=${r.entry_id}` : "/steuerberater"} className="font-semibold text-forest underline">{no}</Link></td>
                    <td className="hidden max-w-[14rem] lg:table-cell"><span title={e?.text}>{e ? `${deDate(e.entry_date)} · ${e.text}` : ""}</span></td>
                    <td><span>{r.field}</span></td>
                    <td className="max-w-[12rem]"><span title={r.old_value ?? ""}>{r.old_value ?? "leer"}</span></td>
                    <td className="max-w-[12rem]"><span title={r.new_value ?? ""}>{r.new_value ?? "leer"}</span></td>
                    <td className="max-w-[18rem]"><span title={r.reason}>{r.reason}</span></td>
                    <td className="hidden lg:table-cell"><span title={r.changed_by_email ?? ""}>{r.changed_by_email ?? ""}{r.changed_by_role === "admin" ? " (Inhaberin)" : ""}</span></td>
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
