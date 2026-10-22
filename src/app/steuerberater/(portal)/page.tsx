import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccountingSettings, getShopMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { classifyEntry, correctEntry } from "../actions";
import { Flash, MONATE, Toolbar, deDate, eur, monthParam } from "./toolbar";

export const metadata = { title: { absolute: "Kassenbuch – Steuerberater-Portal" } };

type Change = { id: number; entry_id: number; field: string; old_value: string | null; new_value: string | null; reason: string; changed_by_email: string | null; changed_by_role: string | null; changed_at: string };

const time = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
const vatTxt = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

export default async function PortalCashBook({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { year, month } = parseMonth(monthParam(sp));
  const m = monthKey(year, month);
  const [book, acc] = await Promise.all([getShopMonth(year, month), getAccountingSettings()]);
  const ids = book.entries.map((e) => e.id);
  const { data: ch } = ids.length
    ? await supabaseAdmin().from("cashbook_changes").select("*").in("entry_id", ids).order("changed_at", { ascending: false })
    : { data: [] as Change[] };
  const changes = (ch ?? []) as Change[];
  const changed = new Set(changes.map((c) => c.entry_id));
  const sel = book.entries.find((e) => String(e.id) === sp.e);
  const selChanges = sel ? changes.filter((c) => c.entry_id === sel.id) : [];
  const href = (id: number) => `/steuerberater?m=${m}&e=${id}#bearbeiten`;

  return (
    <div className="space-y-3">
      <Toolbar action="/steuerberater" year={year} month={month} book="shop">
        <div>
          <span className="stb-label">Kasse</span>
          <input readOnly value={`${acc.cashAccount} – Kasse Laden`} className="stb-field w-44" aria-label="Kasse" />
        </div>
        <div>
          <span className="stb-label">Anfangsbestand</span>
          <input readOnly value={`${eur(book.opening)} €`} className="stb-field w-32 text-right" aria-label="Anfangsbestand" />
        </div>
        <div>
          <span className="stb-label">Endbestand</span>
          <input readOnly value={`${eur(book.closing)} €`} className="stb-field w-32 text-right font-semibold" aria-label="Endbestand" />
        </div>
      </Toolbar>

      <Flash msg={sp.msg} err={sp.err} />

      <div className="stb-panel">
        <h2 className="flex flex-wrap items-center justify-between gap-2">
          <span>Kassenbuch {MONATE[month - 1]} {year}</span>
          <span className="font-normal text-[#555]">{book.closedAt ? `Monat abgeschlossen am ${deDate(book.closedAt.slice(0, 10))}` : "Monat offen"} · {book.entries.length} Buchungen</span>
        </h2>
        <div className="max-h-[60vh] overflow-auto">
          <table className="stb-grid min-w-[62rem]">
            <thead>
              <tr>
                <th className="rownum" aria-label="Zeile"></th>
                <th>Lfd. Nr.</th>
                <th className="num">Einnahme</th>
                <th className="num">Ausgabe</th>
                <th className="num">Lfd. Bestand</th>
                <th>Datum</th>
                <th className="w-full">Buchungstext</th>
                <th>BU</th>
                <th>Gegenkonto</th>
                <th className="num">USt %</th>
                <th>Notiz</th>
              </tr>
            </thead>
            <tbody>
              {book.entries.map((e, i) => {
                const h = href(e.id);
                return (
                  <tr key={e.id} className={`${sel?.id === e.id ? "sel" : ""} ${e.stornoed || e.storno_of ? "dim" : ""}`} aria-selected={sel?.id === e.id}>
                    <td className="rownum"><span>{i + 1}</span></td>
                    <td><Link href={h}>{e.no}</Link></td>
                    <td className="num"><Link href={h} tabIndex={-1}>{e.income ? eur(e.income) : ""}</Link></td>
                    <td className="num"><Link href={h} tabIndex={-1}>{e.expense ? eur(e.expense) : ""}</Link></td>
                    <td className="num"><Link href={h} tabIndex={-1}>{eur(e.balance)}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{deDate(e.entry_date)}</Link></td>
                    <td className="max-w-[22rem]">
                      <Link href={h} tabIndex={-1} title={e.text}>
                        {e.text}
                        {e.stornoed && " (storniert)"}
                        {changed.has(e.id) && <span className="chg ml-1.5 text-[11px] font-semibold text-[#b4232a]" title="Geändert – siehe Protokoll">✎ geändert</span>}
                      </Link>
                    </td>
                    <td><Link href={h} tabIndex={-1}>{e.bu ?? ""}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{e.contra_account ?? ""}</Link></td>
                    <td className="num"><Link href={h} tabIndex={-1}>{vatTxt(e.vat_rate)}</Link></td>
                    <td className="max-w-[14rem]"><Link href={h} tabIndex={-1} title={e.note ?? undefined}>{e.note ?? ""}</Link></td>
                  </tr>
                );
              })}
              {!book.entries.length && (
                <tr><td colSpan={11}><span className="!py-4 text-center text-[#666]">Keine Buchungen in diesem Monat.</span></td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Summe</td>
                <td className="num">{eur(book.income)}</td>
                <td className="num">{eur(book.expense)}</td>
                <td className="num">{eur(book.closing)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <section id="bearbeiten" className="stb-panel scroll-mt-4" aria-labelledby="bearb-h">
        <h2 id="bearb-h">Bearbeiten{sel ? ` – Buchung ${sel.no}` : ""}</h2>
        {!sel ? (
          <p className="p-3 text-[#555]">Zeile in der Tabelle anklicken, um Kontierung (BU, Gegenkonto, USt %) und Notiz zu bearbeiten. Jede Änderung braucht einen Grund und wird protokolliert.</p>
        ) : (
          <div className="grid gap-4 p-3 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                <dt className="text-[#666]">Datum</dt><dd>{deDate(sel.entry_date)}</dd>
                <dt className="text-[#666]">Buchungstext</dt><dd>{sel.text}</dd>
                <dt className="text-[#666]">Betrag</dt><dd>{sel.income ? `Einnahme ${eur(sel.income)} €` : `Ausgabe ${eur(sel.expense)} €`}</dd>
              </dl>
              <form action={classifyEntry} className="space-y-2 border-t border-[#ddd] pt-3">
                <input type="hidden" name="id" value={sel.id} />
                <input type="hidden" name="m" value={m} />
                <p className="font-semibold">Kontierung</p>
                <div className="flex flex-wrap gap-2">
                  <div><label htmlFor="f-bu" className="stb-label">BU</label><input id="f-bu" name="bu" defaultValue={sel.bu ?? ""} maxLength={4} inputMode="numeric" className="stb-field w-16" /></div>
                  <div><label htmlFor="f-contra" className="stb-label">Gegenkonto</label><input id="f-contra" name="contra" defaultValue={sel.contra_account ?? ""} maxLength={9} inputMode="numeric" className="stb-field w-28" /></div>
                  <div><label htmlFor="f-vat" className="stb-label">USt %</label><input id="f-vat" name="vat" defaultValue={vatTxt(sel.vat_rate)} maxLength={5} inputMode="decimal" className="stb-field w-16 text-right" /></div>
                  <div className="min-w-[12rem] flex-1"><label htmlFor="f-note" className="stb-label">Notiz</label><input id="f-note" name="note" defaultValue={sel.note ?? ""} maxLength={300} className="stb-field w-full" /></div>
                </div>
                <div>
                  <label htmlFor="f-reason" className="stb-label">Grund der Änderung (Pflichtfeld)</label>
                  <input id="f-reason" name="reason" required minLength={3} maxLength={300} placeholder="z. B. Kontierung nach Beleg, Wareneinkauf 7 %" className="stb-field w-full" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="stb-btn primary">Änderung speichern</button>
                  <Link href={`/steuerberater?m=${m}`} className="stb-btn">Abbrechen</Link>
                </div>
              </form>

              {!sel.storno_of && !sel.stornoed && (
                <details className="border border-[#ddd]">
                  <summary className="cursor-pointer bg-[#f6f6f6] px-2 py-1 font-semibold">Betrag oder Text falsch? Korrekturbuchung</summary>
                  <form action={correctEntry} className="space-y-2 p-2">
                    <input type="hidden" name="id" value={sel.id} />
                    <input type="hidden" name="m" value={m} />
                    <p className="text-[#555]">Die Buchung bleibt erhalten. Gebucht werden heute eine Stornobuchung und – falls angegeben – eine neue, richtige Buchung (GoBD).</p>
                    <div className="flex flex-wrap gap-2">
                      <div>
                        <label htmlFor="k-side" className="stb-label">Art</label>
                        <select id="k-side" name="side" defaultValue={sel.income ? "in" : "out"} className="stb-field"><option value="in">Einnahme</option><option value="out">Ausgabe</option></select>
                      </div>
                      <div><label htmlFor="k-amount" className="stb-label">Richtiger Betrag (€)</label><input id="k-amount" name="amount" defaultValue={eur(sel.income || sel.expense)} inputMode="decimal" className="stb-field w-28 text-right" /></div>
                      <div className="min-w-[12rem] flex-1"><label htmlFor="k-text" className="stb-label">Richtiger Buchungstext</label><input id="k-text" name="text" defaultValue={sel.text} maxLength={200} className="stb-field w-full" /></div>
                    </div>
                    <label className="flex items-center gap-2"><input type="checkbox" name="only_storno" />Nur stornieren (keine neue Buchung)</label>
                    <div>
                      <label htmlFor="k-reason" className="stb-label">Grund der Korrektur (Pflichtfeld)</label>
                      <input id="k-reason" name="reason" required minLength={3} maxLength={300} className="stb-field w-full" />
                    </div>
                    <button className="stb-btn">Storno und Korrektur buchen</button>
                  </form>
                </details>
              )}
            </div>

            <div>
              <p className="mb-1 font-semibold">Änderungen an dieser Buchung</p>
              {selChanges.length ? (
                <table className="stb-grid">
                  <thead><tr><th>Zeitpunkt</th><th>Feld</th><th>Alt</th><th>Neu</th><th>Grund</th><th>Von</th></tr></thead>
                  <tbody>
                    {selChanges.map((c) => (
                      <tr key={c.id}>
                        <td><span>{time(c.changed_at)}</span></td>
                        <td><span>{c.field}</span></td>
                        <td className="max-w-[8rem]"><span title={c.old_value ?? ""}>{c.old_value ?? "–"}</span></td>
                        <td className="max-w-[8rem]"><span title={c.new_value ?? ""}>{c.new_value ?? "–"}</span></td>
                        <td className="max-w-[12rem]"><span title={c.reason}>{c.reason}</span></td>
                        <td className="max-w-[10rem]"><span title={c.changed_by_email ?? ""}>{c.changed_by_role === "admin" ? "Inhaberin" : "Steuerberater"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[#666]">Noch keine Änderungen – so erfasst, wie im Laden gebucht.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
