import { monthKey } from "@/lib/cashbook";
import { PeriodSelect } from "./client";

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const eur = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const deDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** "Kassenbuch Laden ▷ Kassenbuch bearbeiten" */
export function Crumbs({ a, b }: { a: string; b: string }) {
  return (
    <p className="stb-bar flex items-center gap-2 text-[13.5px]">
      <span>{a}</span><span aria-hidden="true" className="text-[10px] text-[#888]">▷</span><span className="font-bold">{b}</span>
    </p>
  );
}

const I = {
  xlsx: <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 1.5h8l3 3v12h-11z" fill="#fff" stroke="#555" /><path d="M5.5 8l4 5m0-5l-4 5" stroke="#1f7a3f" strokeWidth="1.6" /></svg>,
  datev: <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M13.5 4.2A5.6 5.6 0 1 0 13.5 13.8" fill="none" stroke="#1f4f8a" strokeWidth="2" /><path d="M2.5 7.5h8M2.5 10.5h8" stroke="#1f4f8a" strokeWidth="1.6" /></svg>,
  log: <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 15l1-3.5L12.5 3l2.5 2.5L6.5 14z" fill="#e9eef5" stroke="#3a5f8c" /><path d="M3 15l3.5-1" stroke="#3a5f8c" /></svg>,
};

/** Icon row above the form: Excel, DATEV, change log. */
export function IconBar({ book, m, children }: { book: "shop" | "online"; m: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#dcdcdc] px-2 py-1">
      <a href={`/steuerberater/export?book=${book}&m=${m}&format=xlsx`} className="stb-icon" title="Excel-Datei (.xlsx) herunterladen" aria-label="Excel-Datei herunterladen">{I.xlsx}</a>
      <a href={`/steuerberater/export?book=${book}&m=${m}&format=datev`} className="stb-icon" title="DATEV-Buchungsstapel herunterladen" aria-label="DATEV-Export herunterladen">{I.datev}</a>
      {book === "shop" && <a href="/steuerberater/protokoll" className="stb-icon" title="Änderungsprotokoll" aria-label="Änderungsprotokoll">{I.log}</a>}
      <span className="ml-auto text-[#666]">{children}</span>
    </div>
  );
}

/** Kasse · Mandant / Jahr · Monat · Anfangsbestand · Endbestand – as in Agenda's header form. */
export function HeadForm({ kasse, mandant, year, month, opening, closing, openingLabel = "Anfangsbestand", closingLabel = "Endbestand" }: { kasse: string; mandant: string; year: number; month: number; opening: string; closing: string; openingLabel?: string; closingLabel?: string }) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const years = Array.from({ length: Math.max(1, now.getFullYear() - 2025 + 1) }, (_, i) => 2025 + i).reverse();
  return (
    <div className="grid items-center gap-x-3 gap-y-2 px-2 py-2 sm:grid-cols-[auto_minmax(0,17rem)_auto_minmax(0,16rem)] lg:grid-cols-[auto_minmax(0,17rem)_auto_minmax(0,16rem)_auto_minmax(0,11rem)]">
      <span className="stb-label">Kasse</span>
      <input readOnly value={kasse} className="stb-field !text-[#222]" aria-label="Kasse" />
      <span className="stb-label">Mandant</span>
      <input readOnly value={mandant} className="stb-field" aria-label="Mandant" />
      <span className="hidden lg:block" /><span className="hidden lg:block" />
      <label htmlFor="ps-y" className="stb-label">Jahr</label>
      <div className="flex items-center gap-1">
        <PeriodSelect year={year} month={month} years={years} />
      </div>
      <span className="stb-label">{openingLabel}</span>
      <input readOnly value={opening} className="stb-field" aria-label={openingLabel} />
      <span className="stb-label">{closingLabel}</span>
      <input readOnly value={closing} className="stb-field" aria-label={closingLabel} />
    </div>
  );
}

/** ?m=2026-10 */
export function monthParam(sp: Record<string, string | undefined>) {
  return sp.m;
}
export const key = monthKey;

export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <p role="alert" className="mx-2 mt-2 border border-[#e2b4b4] bg-[#fbeaea] px-3 py-1.5 text-[#8a1f1f]">{err}</p>;
  if (msg) return <p role="status" className="mx-2 mt-2 border border-[#bcd7bc] bg-[#eef7ee] px-3 py-1.5 text-[#285c28]">{msg}</p>;
  return null;
}
