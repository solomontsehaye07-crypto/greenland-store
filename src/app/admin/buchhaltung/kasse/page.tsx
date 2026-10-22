import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { getAccountingSettings, getShopMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { ExportLinks, Flash, MonthNav } from "../month-nav";
import { closeMonth, deleteTemplate, saveTemplate, setOpening, stornoEntry } from "../actions";
import { EntryForm } from "./entry-form";

export const metadata = { title: "Cash book" };
export const dynamic = "force-dynamic";

const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export default async function CashBookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(["admin"]);
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);
  const m = monthKey(year, month);
  const [book, acc, { data: templates }] = await Promise.all([
    getShopMonth(year, month),
    getAccountingSettings(),
    supabaseAdmin().from("cashbook_templates").select("id, text, kind, bu, contra_account, vat_rate").order("sort").order("text"),
  ]);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const thisMonth = today.slice(0, 7) === m;
  const ended = m < today.slice(0, 7);
  const lastDay = `${m}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  const canBook = !book.closedAt && m <= today.slice(0, 7);
  const ids = book.entries.map((e) => e.id);
  const { data: ch } = ids.length ? await supabaseAdmin().from("cashbook_changes").select("entry_id").in("entry_id", ids) : { data: [] as { entry_id: number }[] };
  const edited = new Set((ch ?? []).map((c) => c.entry_id));
  const tpl = (templates ?? []).map((t) => ({ ...t, kind: t.kind as "in" | "out", vat_rate: t.vat_rate == null ? null : Number(t.vat_rate) }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/admin/buchhaltung?m=${m}`} className="text-sm text-muted underline">Bookkeeping</Link>
          <h1 className="display mt-1 text-3xl font-extrabold">Cash book – shop</h1>
          <p className="mt-1 text-sm text-muted">Kasse {acc.cashAccount} · only cash in the shop. Online orders are in their own book.</p>
        </div>
        <MonthNav base="/admin/buchhaltung/kasse" year={year} month={month} />
      </header>
      <Flash msg={sp.msg} err={sp.err} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Opening balance", book.opening],
          ["Money in", book.income],
          ["Money out", book.expense],
          ["Closing balance", book.closing],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-medium text-muted">{l}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{money(Number(v))}</p>
          </div>
        ))}
      </div>

      {!book.entries.length && !book.closedAt && (
        <form action={setOpening} className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-line bg-white p-5">
          <input type="hidden" name="m" value={m} />
          <div>
            <label htmlFor="opening" className="label">Opening balance for this month</label>
            <input id="opening" name="opening" defaultValue={book.opening.toFixed(2).replace(".", ",")} inputMode="decimal" className="input w-40 text-right tabular-nums" />
          </div>
          <button className="btn btn-ghost">Set opening balance</button>
          <p className="max-w-md text-xs text-muted">Only needed for your first month here: take the closing balance from Agenda (e.g. 617,72 € at the end of October). Later months carry it over automatically.</p>
        </form>
      )}

      {canBook ? (
        <EntryForm templates={tpl} today={thisMonth ? today : lastDay} minDate={`${m}-01`} m={m} />
      ) : (
        <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">{book.closedAt ? `This month was closed on ${de(book.closedAt.slice(0, 10))}. No more entries can be added.` : "Entries can't be dated in the future."}</p>
      )}

      <section aria-labelledby="list-h" className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <h2 id="list-h" className="text-lg font-bold">Entries</h2>
          <ExportLinks book="shop" m={m} label="Export:" />
        </div>
        {book.entries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-surface text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 text-right font-medium">Money in</th>
                  <th className="px-3 py-2 text-right font-medium">Money out</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Booking text</th>
                  <th className="px-3 py-2 font-medium">BU</th>
                  <th className="px-3 py-2 font-medium">Counter acc.</th>
                  <th className="px-3 py-2 font-medium">VAT</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {book.entries.map((e) => (
                  <tr key={e.id} className={`border-t border-line ${e.stornoed || e.storno_of ? "text-muted" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2">{e.no}</td>
                    <td className="px-3 py-2 text-right">{e.income ? money(e.income) : ""}</td>
                    <td className="px-3 py-2 text-right">{e.expense ? money(e.expense) : ""}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(e.balance)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{de(e.entry_date)}</td>
                    <td className="px-3 py-2">{e.text}{e.stornoed && <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[0.6875rem] font-semibold">reversed</span>}{edited.has(e.id) && <a href={`/steuerberater?m=${m}&e=${e.id}#bearbeiten`} title="Accounts changed – see the change log" className="ml-2 rounded bg-[#fdf1e7] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-terra">edited</a>}</td>
                    <td className="px-3 py-2">{e.bu ?? ""}</td>
                    <td className="px-3 py-2">{e.contra_account ?? ""}</td>
                    <td className="px-3 py-2">{e.vat_rate == null ? "" : `${String(e.vat_rate).replace(".", ",")} %`}</td>
                    <td className="max-w-[14rem] truncate px-3 py-2" title={e.note ?? undefined}>{e.note ?? ""}</td>
                    <td className="px-3 py-2 text-right">
                      {!e.stornoed && !e.storno_of && !book.closedAt && (
                        <details className="relative inline-block text-left">
                          <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs font-semibold text-terra hover:bg-surface">Reverse</summary>
                          <form action={stornoEntry} className="absolute right-0 z-10 mt-1 w-72 space-y-2 rounded-xl border border-line bg-white p-3 shadow-lg">
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="m" value={m} />
                            <label htmlFor={`r-${e.id}`} className="label">Reason</label>
                            <input id={`r-${e.id}`} name="reason" maxLength={300} placeholder="e.g. typing mistake" className="input" />
                            <p className="text-xs text-muted">Books the opposite amount today. The original entry stays visible.</p>
                            <button className="btn btn-primary w-full !py-1.5">Book reversal</button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted">No entries this month yet.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <details className="rounded-2xl border border-line bg-white p-5">
          <summary className="cursor-pointer text-lg font-bold">Templates (Buchungsvorlagen)</summary>
          <ul className="mt-3 divide-y divide-line">
            {tpl.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><span className={t.kind === "in" ? "text-forest" : "text-terra"}>{t.kind === "in" ? "Money in" : "Money out"}</span> · {t.text}{t.contra_account ? ` · Gegenkonto ${t.contra_account}` : ""}</span>
                <form action={deleteTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="m" value={m} />
                  <button className="text-xs font-semibold text-muted underline hover:text-ink">Delete</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveTemplate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="m" value={m} />
            <div className="sm:col-span-2"><label htmlFor="t-text" className="label">New template text</label><input id="t-text" name="text" maxLength={200} required className="input" /></div>
            <div><label htmlFor="t-kind" className="label">Type</label><select id="t-kind" name="kind" className="input"><option value="in">Money in</option><option value="out">Money out</option></select></div>
            <div><label htmlFor="t-contra" className="label">Counter account (optional)</label><input id="t-contra" name="contra" maxLength={9} inputMode="numeric" className="input" /></div>
            <div><label htmlFor="t-bu" className="label">BU key (optional)</label><input id="t-bu" name="bu" maxLength={4} className="input" /></div>
            <div><label htmlFor="t-vat" className="label">VAT % (optional)</label><input id="t-vat" name="vat" maxLength={5} inputMode="decimal" className="input" /></div>
            <div className="sm:col-span-2"><button className="btn btn-ghost">Add template</button></div>
          </form>
        </details>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Close the month</h2>
          <p className="mt-1 text-sm text-muted">After sending the month to the Steuerberater, close it. Closed months can&apos;t take new entries; corrections then go into the current month.</p>
          {book.closedAt ? (
            <p className="mt-3 text-sm font-semibold text-forest">Closed on {de(book.closedAt.slice(0, 10))}.</p>
          ) : ended ? (
            <form action={closeMonth} className="mt-3">
              <input type="hidden" name="m" value={m} />
              <button className="btn btn-primary">Close {m}</button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">Possible once the month has ended.</p>
          )}
        </div>
      </div>
    </div>
  );
}
