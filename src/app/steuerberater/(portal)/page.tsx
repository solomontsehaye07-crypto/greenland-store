import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccountingSettings, getShopMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { classifyEntry, correctEntry } from "../actions";
import { EscClose, GridScroll } from "./client";
import { Flash, MonthStrip, Ribbon, deDate, eur, monthParam } from "./toolbar";

export const metadata = { title: { absolute: "Kassenbuch Laden – Kanzlei-Zugang" } };

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
  const href = (id: number) => `/steuerberater?m=${m}&e=${id}`;
  const open = book.entries.filter((e) => !e.contra_account && !e.storno_of && !e.stornoed).length;

  return (
    <>
      <MonthStrip base="/steuerberater" year={year} month={month} title="Kassenbuch Laden" book="shop" />
      <Ribbon
        items={[
          { label: "Anfangsbestand", value: eur(book.opening) },
          { label: "Einnahmen", value: eur(book.income), op: "+" },
          { label: "Ausgaben", value: eur(book.expense), op: "−" },
          { label: "Endbestand", value: eur(book.closing), op: "=", strong: true },
        ]}
        meta={`Kasse ${acc.cashAccount} · Mandant ${acc.client} · ${book.closedAt ? `abgeschlossen am ${deDate(book.closedAt.slice(0, 10))}` : "Monat offen"}`}
      />
      {!sel && <Flash msg={sp.msg} err={sp.err} />}

      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Buchungen" className="stb-sheet overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-[13px]">
            <span className="font-semibold">{book.entries.length} Buchungen</span>
            <span className="text-muted">{open ? `${open} ohne Gegenkonto` : "alle Buchungen kontiert"} · <span className="stb-dot !ml-0" /> geändert</span>
          </div>
          {/* phones: one card per line */}
          <ul className="divide-y divide-line sm:hidden">
            {book.entries.map((e) => (
              <li key={e.id}>
                <Link href={href(e.id)} className={`flex items-start gap-3 px-4 py-3 ${sel?.id === e.id ? "bg-forest/10 shadow-[inset_4px_0_0_var(--forest)]" : ""} ${e.stornoed || e.storno_of ? "text-muted line-through" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.text}{changed.has(e.id) && <span className="stb-dot" />}</span>
                    <span className="block text-[12.5px] text-muted">{e.no} · {deDate(e.entry_date)}</span>
                    {(e.contra_account || e.bu || e.vat_rate != null) && <span className="mt-0.5 block text-[12.5px] text-muted">{[e.contra_account && `Gegenkonto ${e.contra_account}`, e.bu && `BU ${e.bu}`, e.vat_rate != null && `${vatTxt(e.vat_rate)} % USt`].filter(Boolean).join(" · ")}</span>}
                  </span>
                  <span className="num shrink-0 text-right">
                    <span className={`block font-semibold ${e.income ? "text-forest" : "text-terra"}`}>{e.income ? `+${eur(e.income)}` : `−${eur(e.expense)}`}</span>
                    <span className="block text-[12.5px] text-muted">{eur(e.balance)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!book.entries.length && <li className="px-4 py-6 text-center text-muted">Keine Buchungen in diesem Monat.</li>}
          </ul>
          <GridScroll className="hidden max-h-[64dvh] overflow-auto sm:block">
            <table className="stb-grid min-w-[42rem] xl:min-w-[54rem]">
              <thead>
                <tr className="group">
                  <th colSpan={6}>Kassenbewegung</th>
                  <th colSpan={4}>Kontierung</th>
                </tr>
                <tr>
                  <th className="stick">Nr.</th>
                  <th>Datum</th>
                  <th className="w-full">Buchungstext</th>
                  <th className="num">Einnahme</th>
                  <th className="num">Ausgabe</th>
                  <th className="num">Bestand</th>
                  <th>BU</th>
                  <th>Gegenkonto</th>
                  <th className="num">USt %</th>
                  <th className="hidden xl:table-cell">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {book.entries.map((e) => {
                  const h = href(e.id);
                  const on = sel?.id === e.id;
                  return (
                    <tr key={e.id} className={`${on ? "sel" : ""} ${e.stornoed || e.storno_of ? "dim" : ""}`} aria-selected={on}>
                      <td className="stick"><Link href={h} aria-label={`Buchung ${e.no} öffnen`} title={e.no}><span className="xl:hidden">{e.seq}</span><span className="hidden xl:inline">{e.no}</span></Link></td>
                      <td><Link href={h} tabIndex={-1}><span className="xl:hidden">{deDate(e.entry_date).slice(0, 6)}</span><span className="hidden xl:inline">{deDate(e.entry_date)}</span></Link></td>
                      <td className="max-w-[20rem]">
                        <Link href={h} tabIndex={-1} title={e.text}>
                          {e.text}
                          {changed.has(e.id) && <span className="stb-dot" title="Geändert – siehe Protokoll" />}
                        </Link>
                      </td>
                      <td className="num"><Link href={h} tabIndex={-1}>{e.income ? eur(e.income) : ""}</Link></td>
                      <td className="num"><Link href={h} tabIndex={-1}>{e.expense ? eur(e.expense) : ""}</Link></td>
                      <td className="num font-semibold"><Link href={h} tabIndex={-1}>{eur(e.balance)}</Link></td>
                      <td className="k"><Link href={h} tabIndex={-1}>{e.bu ?? ""}</Link></td>
                      <td className="k"><Link href={h} tabIndex={-1}>{e.contra_account ?? ""}</Link></td>
                      <td className="k num"><Link href={h} tabIndex={-1}>{vatTxt(e.vat_rate)}</Link></td>
                      <td className="k hidden max-w-[12rem] xl:table-cell"><Link href={h} tabIndex={-1} title={e.note ?? undefined}>{e.note ?? ""}</Link></td>
                    </tr>
                  );
                })}
                {!book.entries.length && (
                  <tr><td colSpan={10}><span className="!py-6 text-center text-muted">Keine Buchungen in diesem Monat.</span></td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Summe {book.entries.length ? `(${book.entries.length})` : ""}</td>
                  <td className="num">{eur(book.income)}</td>
                  <td className="num">{eur(book.expense)}</td>
                  <td className="num">{eur(book.closing)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </GridScroll>
        </section>

        {sel && <Link href={`/steuerberater?m=${m}`} aria-label="Bearbeiten schließen" className="fixed inset-0 z-30 bg-ink/35 min-[1100px]:hidden" />}
        {sel && <EscClose href={`/steuerberater?m=${m}`} />}
        <aside
          id="bearbeiten"
          aria-label="Kontierung"
          className={`stb-sheet min-[1100px]:sticky min-[1100px]:top-4 min-[1100px]:max-h-[calc(100dvh-2rem)] min-[1100px]:overflow-y-auto ${sel ? "stb-sheet-pop max-[1099px]:fixed max-[1099px]:inset-x-0 max-[1099px]:bottom-0 max-[1099px]:z-40 max-[1099px]:max-h-[88dvh] max-[1099px]:overflow-y-auto max-[1099px]:!rounded-b-none max-[1099px]:shadow-2xl md:max-[1099px]:inset-x-auto md:max-[1099px]:inset-y-0 md:max-[1099px]:right-0 md:max-[1099px]:max-h-none md:max-[1099px]:w-[26rem] md:max-[1099px]:!rounded-none" : "hidden min-[1100px]:block"}`}
        >
          {!sel ? (
            <div className="space-y-2 p-5">
              <p className="display text-lg font-bold">Kontierung</p>
              <p className="text-muted">Eine Zeile in der Tabelle anklicken. Hier lassen sich dann BU, Gegenkonto, USt-Satz und Notiz eintragen – jede Änderung mit Grund, alles wird protokolliert.</p>
              <p className="text-muted">Betrag oder Text falsch? Auch das geht hier, als Storno mit neuer Buchung.</p>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 border-b border-line bg-surface px-5 py-4">
                <span aria-hidden="true" className="mx-auto -mt-1 mb-3 block h-1 w-10 rounded-full bg-ink/20 md:hidden" />
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-muted">Buchung {sel.no} · {deDate(sel.entry_date)}</p>
                  <Link href={`/steuerberater?m=${m}`} className="-m-2 p-2 text-[12px] font-semibold text-muted underline hover:text-ink">schließen</Link>
                </div>
                <p className="mt-1 font-semibold">{sel.text}</p>
                <p className={`num mt-0.5 text-xl font-bold ${sel.income ? "text-forest" : "text-terra"}`}>{sel.income ? `+ ${eur(sel.income)}` : `− ${eur(sel.expense)}`} €</p>
                {(sel.stornoed || sel.storno_of) && <p className="mt-1 text-[12px] text-muted">{sel.stornoed ? "Diese Buchung wurde storniert." : "Stornobuchung."}</p>}
              </div>

              {(sp.msg || sp.err) && <div className="px-5 pt-4"><Flash msg={sp.msg} err={sp.err} /></div>}
              <form action={classifyEntry} key={sel.id} className="space-y-3 px-5 py-4">
                <input type="hidden" name="id" value={sel.id} />
                <input type="hidden" name="m" value={m} />
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] gap-2">
                  <div><label htmlFor="k-bu" className="stb-label">BU</label><input id="k-bu" name="bu" defaultValue={sel.bu ?? ""} maxLength={4} inputMode="numeric" className="stb-field" /></div>
                  <div><label htmlFor="k-contra" className="stb-label">Gegenkonto</label><input id="k-contra" name="contra" defaultValue={sel.contra_account ?? ""} maxLength={9} inputMode="numeric" className="stb-field" /></div>
                  <div><label htmlFor="k-vat" className="stb-label">USt %</label><input id="k-vat" name="vat" defaultValue={vatTxt(sel.vat_rate)} maxLength={5} inputMode="decimal" className="stb-field text-right" /></div>
                </div>
                <div><label htmlFor="k-note" className="stb-label">Notiz</label><input id="k-note" name="note" defaultValue={sel.note ?? ""} maxLength={300} className="stb-field" /></div>
                <div>
                  <label htmlFor="k-reason" className="stb-label">Grund der Änderung <span className="font-normal">(Pflicht)</span></label>
                  <textarea id="k-reason" name="reason" required minLength={3} maxLength={300} rows={2} placeholder="z. B. Kontierung nach Beleg" className="stb-field !h-auto" />
                </div>
                <button className="stb-btn go w-full justify-center">Kontierung speichern</button>
              </form>

              <div className="border-t border-line px-5 py-4">
                <p className="text-[12px] font-semibold text-muted">Verlauf</p>
                {selChanges.length ? (
                  <ol className="mt-2 space-y-2.5 border-l-2 border-line pl-3">
                    {selChanges.map((c) => (
                      <li key={c.id} className="text-[13px]">
                        <p><span className="font-semibold">{c.field}</span>: {c.old_value ?? "leer"} → {c.new_value ?? "leer"}</p>
                        <p className="text-muted">„{c.reason}“ · {c.changed_by_role === "admin" ? "Inhaberin" : "Kanzlei"} · {time(c.changed_at)}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-muted">Unverändert, so wie im Laden erfasst.</p>
                )}
              </div>

              {!sel.storno_of && !sel.stornoed && (
                <details className="border-t border-line">
                  <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold">Betrag oder Text korrigieren</summary>
                  <form action={correctEntry} className="space-y-3 px-5 pb-5">
                    <input type="hidden" name="id" value={sel.id} />
                    <input type="hidden" name="m" value={m} />
                    <p className="text-[12.5px] text-muted">Die Buchung bleibt stehen. Heute werden ein Storno und – falls angegeben – die richtige Buchung erfasst.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="c-side" className="stb-label">Art</label>
                        <select id="c-side" name="side" defaultValue={sel.income ? "in" : "out"} className="stb-field"><option value="in">Einnahme</option><option value="out">Ausgabe</option></select>
                      </div>
                      <div><label htmlFor="c-amount" className="stb-label">Richtiger Betrag</label><input id="c-amount" name="amount" defaultValue={eur(sel.income || sel.expense)} inputMode="decimal" className="stb-field text-right" /></div>
                    </div>
                    <div><label htmlFor="c-text" className="stb-label">Richtiger Buchungstext</label><input id="c-text" name="text" defaultValue={sel.text} maxLength={200} className="stb-field" /></div>
                    <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="only_storno" className="h-4 w-4 accent-[var(--forest)]" />Nur stornieren</label>
                    <div><label htmlFor="c-reason" className="stb-label">Grund der Korrektur <span className="font-normal">(Pflicht)</span></label><input id="c-reason" name="reason" required minLength={3} maxLength={300} className="stb-field" /></div>
                    <button className="stb-btn w-full justify-center">Storno und Korrektur buchen</button>
                  </form>
                </details>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
