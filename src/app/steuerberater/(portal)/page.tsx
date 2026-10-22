import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccountingSettings, getShopMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { classifyEntry, correctEntry } from "../actions";
import { GridScroll } from "./client";
import { Crumbs, Flash, HeadForm, IconBar, deDate, eur, monthParam } from "./toolbar";

export const metadata = { title: { absolute: "Kassenbuch – Steuerberater-Portal" } };

type Change = { id: number; entry_id: number; field: string; old_value: string | null; new_value: string | null; reason: string; changed_by_email: string | null; changed_by_role: string | null; changed_at: string };

const time = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
const vatTxt = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

const Pencil = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className="absolute left-1 top-1/2 -translate-y-1/2"><path d="M2 12l.8-3L9.6 2.2l2.2 2.2L5 11.2z" fill="currentColor" /></svg>
);

export default async function PortalCashBook({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { year, month } = parseMonth(monthParam(sp));
  const m = monthKey(year, month);
  const [book, acc, { data: st }] = await Promise.all([
    getShopMonth(year, month),
    getAccountingSettings(),
    supabaseAdmin().from("settings").select("value").eq("key", "public.store").maybeSingle(),
  ]);
  const storeName = ((st?.value ?? {}) as { name?: string }).name || "Greenland Afro Asia Store";
  const ids = book.entries.map((e) => e.id);
  const { data: ch } = ids.length
    ? await supabaseAdmin().from("cashbook_changes").select("*").in("entry_id", ids).order("changed_at", { ascending: false })
    : { data: [] as Change[] };
  const changes = (ch ?? []) as Change[];
  const changed = new Set(changes.map((c) => c.entry_id));
  const sel = book.entries.find((e) => String(e.id) === sp.e);
  const selChanges = sel ? changes.filter((c) => c.entry_id === sel.id) : [];
  const href = (id: number) => `/steuerberater?m=${m}&e=${id}`;
  const off = !sel;

  return (
    <>
      <Crumbs a="Kassenbuch Laden" b="Kassenbuch bearbeiten" />
      <IconBar book="shop" m={m}>{book.closedAt ? `Monat abgeschlossen am ${deDate(book.closedAt.slice(0, 10))}` : "Monat offen"}</IconBar>
      <HeadForm kasse={`Kasse (${acc.cashAccount})`} mandant={`${acc.client} ${storeName}`} year={year} month={month} opening={eur(book.opening)} closing={eur(book.closing)} />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="mx-2 border border-[#c3c3c3]">
        <GridScroll className="max-h-[58vh] min-h-[16rem] overflow-auto">
          <table className="stb-grid min-w-[64rem]">
            <thead>
              <tr>
                <th className="ctr">Lfd. Nr.</th>
                <th className="num">Einnahme</th>
                <th className="num">Ausgabe</th>
                <th>Lfd. Bestand</th>
                <th>Datum</th>
                <th className="w-full">Buchungstext</th>
                <th>BU</th>
                <th>Gegenkonto</th>
                <th>USt %</th>
                <th>Notiz</th>
              </tr>
            </thead>
            <tbody>
              {book.entries.map((e) => {
                const h = href(e.id);
                const on = sel?.id === e.id;
                return (
                  <tr key={e.id} className={`${on ? "sel" : ""} ${e.stornoed || e.storno_of ? "dim" : ""}`} aria-selected={on}>
                    <td className="ctr relative">
                      {(on || changed.has(e.id)) && <Pencil />}
                      <Link href={h} className="!px-5" aria-label={`Buchung ${e.no} auswählen`}>{e.no}</Link>
                    </td>
                    <td className="num"><Link href={h} tabIndex={-1}>{e.income ? eur(e.income) : ""}</Link></td>
                    <td className="num"><Link href={h} tabIndex={-1}>{e.expense ? eur(e.expense) : ""}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{eur(e.balance)}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{deDate(e.entry_date)}</Link></td>
                    <td className="max-w-[22rem]">
                      <Link href={h} tabIndex={-1} title={e.text}>
                        {e.text}
                        {e.stornoed && " (storniert)"}
                        {changed.has(e.id) && <span className="chg ml-1.5 text-[11px] text-[#c0222b]" title="Geändert – siehe Änderungsprotokoll">geändert</span>}
                      </Link>
                    </td>
                    <td><Link href={h} tabIndex={-1}>{e.bu ?? ""}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{e.contra_account ?? ""}</Link></td>
                    <td><Link href={h} tabIndex={-1}>{vatTxt(e.vat_rate)}</Link></td>
                    <td className="max-w-[14rem]"><Link href={h} tabIndex={-1} title={e.note ?? undefined}>{e.note ?? ""}</Link></td>
                  </tr>
                );
              })}
              {!book.entries.length && (
                <tr><td colSpan={10}><span className="!py-4 text-center text-[#666]">Keine Buchungen in diesem Monat.</span></td></tr>
              )}
            </tbody>
          </table>
        </GridScroll>
      </div>

      {/* like Agenda's "Erfassen" box: the line on top (read-only), the account fields below */}
      <form id="bearbeiten" action={classifyEntry} className="m-2 border border-[#c3c3c3] bg-[#f4f4f4]">
        <p className="stb-bar font-bold">Bearbeiten</p>
        <input type="hidden" name="id" value={sel?.id ?? ""} />
        <input type="hidden" name="m" value={m} />
        <div className="grid gap-x-3 gap-y-2 p-2 sm:grid-cols-[9rem_9rem_9rem_9rem_minmax(0,1fr)]">
          <div><label htmlFor="b-no" className="stb-label">Lfd. Nr.</label><input id="b-no" readOnly value={sel?.no ?? ""} className="stb-field" /></div>
          <div><label htmlFor="b-in" className="stb-label">Einnahme</label><input id="b-in" readOnly value={sel ? eur(sel.income) : ""} className="stb-field text-right" /></div>
          <div><label htmlFor="b-out" className="stb-label">Ausgabe</label><input id="b-out" readOnly value={sel ? eur(sel.expense) : ""} className="stb-field text-right" /></div>
          <div><label htmlFor="b-date" className="stb-label">Datum</label><input id="b-date" readOnly value={sel ? deDate(sel.entry_date) : ""} className="stb-field" /></div>
          <div><label htmlFor="b-text" className="stb-label">Buchungstext</label><input id="b-text" readOnly value={sel?.text ?? ""} className="stb-field" /></div>
        </div>
        <div className="grid gap-x-3 gap-y-2 px-2 pb-2 sm:grid-cols-[9rem_13rem_minmax(0,22rem)_9rem]" key={sel?.id ?? "none"}>
          <div><label htmlFor="b-bu" className="stb-label">BU</label><input id="b-bu" name="bu" disabled={off} defaultValue={sel?.bu ?? ""} maxLength={4} inputMode="numeric" className="stb-field" /></div>
          <div><label htmlFor="b-contra" className="stb-label">Gegenkonto</label><input id="b-contra" name="contra" disabled={off} defaultValue={sel?.contra_account ?? ""} maxLength={9} inputMode="numeric" className="stb-field" /></div>
          <div><label htmlFor="b-note" className="stb-label">Notiz</label><input id="b-note" name="note" disabled={off} defaultValue={sel?.note ?? ""} maxLength={300} className="stb-field" /></div>
          <div><label htmlFor="b-vat" className="stb-label">USt %</label><input id="b-vat" name="vat" disabled={off} defaultValue={sel ? vatTxt(sel.vat_rate) : ""} maxLength={5} inputMode="decimal" className="stb-field" /></div>
          <div className="sm:col-span-4">
            <label htmlFor="b-reason" className="stb-label">Grund der Änderung (Pflichtfeld)</label>
            <input id="b-reason" name="reason" disabled={off} required minLength={3} maxLength={300} placeholder={off ? "Erst eine Buchung in der Tabelle anklicken" : "z. B. Kontierung nach Beleg"} className="stb-field req disabled:!bg-[#f7f7f7]" />
          </div>
        </div>
        <div className="flex justify-end gap-1 px-2 pb-2">
          <button disabled={off} className="stb-btn">Speichern</button>
          {sel ? <Link href={`/steuerberater?m=${m}`} className="stb-btn">Schließen</Link> : <button type="button" disabled className="stb-btn">Schließen</button>}
        </div>
      </form>

      {sel && (
        <div className="grid gap-2 px-2 pb-2 lg:grid-cols-2">
          <div className="border border-[#c3c3c3] bg-white">
            <p className="stb-bar">Änderungen an Buchung {sel.no}</p>
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
              <p className="p-2 text-[#666]">Noch keine Änderungen – so, wie im Laden gebucht.</p>
            )}
          </div>

          {!sel.storno_of && !sel.stornoed && (
            <details className="self-start border border-[#c3c3c3] bg-[#f4f4f4]">
              <summary className="stb-bar cursor-pointer">Betrag oder Text falsch? Korrekturbuchung</summary>
              <form action={correctEntry} className="space-y-2 p-2">
                <input type="hidden" name="id" value={sel.id} />
                <input type="hidden" name="m" value={m} />
                <p className="text-[#555]">Die Buchung bleibt erhalten. Gebucht werden heute eine Stornobuchung und – falls angegeben – eine neue, richtige Buchung (GoBD).</p>
                <div className="grid gap-2 sm:grid-cols-[8rem_8rem_minmax(0,1fr)]">
                  <div>
                    <label htmlFor="k-side" className="stb-label">Art</label>
                    <select id="k-side" name="side" defaultValue={sel.income ? "in" : "out"} className="stb-field"><option value="in">Einnahme</option><option value="out">Ausgabe</option></select>
                  </div>
                  <div><label htmlFor="k-amount" className="stb-label">Richtiger Betrag</label><input id="k-amount" name="amount" defaultValue={eur(sel.income || sel.expense)} inputMode="decimal" className="stb-field text-right" /></div>
                  <div><label htmlFor="k-text" className="stb-label">Richtiger Buchungstext</label><input id="k-text" name="text" defaultValue={sel.text} maxLength={200} className="stb-field" /></div>
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" name="only_storno" />Nur stornieren (keine neue Buchung)</label>
                <div>
                  <label htmlFor="k-reason" className="stb-label">Grund der Korrektur (Pflichtfeld)</label>
                  <input id="k-reason" name="reason" required minLength={3} maxLength={300} className="stb-field req" />
                </div>
                <div className="flex justify-end"><button className="stb-btn">Storno und Korrektur buchen</button></div>
              </form>
            </details>
          )}
        </div>
      )}
    </>
  );
}
