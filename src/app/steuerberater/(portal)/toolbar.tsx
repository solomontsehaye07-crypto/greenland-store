import { monthKey } from "@/lib/cashbook";

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const deDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Jahr / Monat like the selectors in Agenda, plus the downloads for the shown month. */
export function Toolbar({ action, year, month, book, children }: { action: string; year: number; month: number; book: "shop" | "online"; children?: React.ReactNode }) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const years = Array.from({ length: Math.max(1, now.getFullYear() - 2025 + 1) }, (_, i) => 2025 + i).reverse();
  const m = monthKey(year, month);
  return (
    <div className="stb-panel flex flex-wrap items-end gap-x-4 gap-y-2 px-3 py-2">
      {children}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="tb-y" className="stb-label">Jahr</label>
          <select id="tb-y" name="y" defaultValue={year} className="stb-field">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tb-m" className="stb-label">Monat</label>
          <select id="tb-m" name="mo" defaultValue={month} className="stb-field">
            {MONATE.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <button className="stb-btn">Anzeigen</button>
      </form>
      <div className="ml-auto flex flex-wrap gap-2">
        <a href={`/steuerberater/export?book=${book}&m=${m}&format=xlsx`} className="stb-btn">Excel (.xlsx)</a>
        <a href={`/steuerberater/export?book=${book}&m=${m}&format=datev`} className="stb-btn">DATEV-Export</a>
      </div>
    </div>
  );
}

/** ?y=2026&mo=10 (from the selects) or ?m=2026-10 (from links). */
export function monthParam(sp: Record<string, string | undefined>) {
  if (sp.y && sp.mo) return `${sp.y}-${String(sp.mo).padStart(2, "0")}`;
  return sp.m;
}

export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <p role="alert" className="border border-[#e2b4b4] bg-[#fbeaea] px-3 py-2 text-[#8a1f1f]">{err}</p>;
  if (msg) return <p role="status" className="border border-[#bcd7bc] bg-[#eef7ee] px-3 py-2 text-[#285c28]">{msg}</p>;
  return null;
}
