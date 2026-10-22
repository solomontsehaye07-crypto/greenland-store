import Link from "next/link";
import { monthKey, shiftMonth } from "@/lib/cashbook";

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const eur = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const deDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Title, year arrows and the twelve months as one strip; downloads on the right. */
export function MonthStrip({ base, year, month, title, book }: { base: string; year: number; month: number; title: string; book?: "shop" | "online" }) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const cur = now.getFullYear() * 12 + now.getMonth() + 1;
  const prev = shiftMonth(year, month, -12);
  const m = monthKey(year, month);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-2xl font-bold">{title} <span className="font-normal text-muted">{MONATE[month - 1]} {year}</span></h1>
        {book && (
          <div className="flex flex-wrap gap-2">
            <a href={`/steuerberater/export?book=${book}&m=${m}&format=xlsx`} className="stb-btn">Excel herunterladen</a>
            <a href={`/steuerberater/export?book=${book}&m=${m}&format=datev`} className="stb-btn">DATEV-Stapel</a>
          </div>
        )}
      </div>
      <nav aria-label="Monat wählen" className="stb-months flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
        <Link href={`${base}?m=${monthKey(prev.year, prev.month)}`} aria-label={`Jahr ${year - 1}`} className="!min-w-0 px-3 text-muted">‹ {year - 1}</Link>
        <span className="px-2 font-bold">{year}</span>
        {KURZ.map((k, i) => (
          <Link key={k} href={`${base}?m=${monthKey(year, i + 1)}`} aria-current={i + 1 === month ? "true" : undefined} aria-label={`${MONATE[i]} ${year}`} className={year * 12 + i + 1 > cur ? "future" : ""}>{k}</Link>
        ))}
        {(year + 1) * 12 + 1 <= cur && <Link href={`${base}?m=${monthKey(year + 1, 1)}`} aria-label={`Jahr ${year + 1}`} className="!min-w-0 px-3 text-muted">{year + 1} ›</Link>}
      </nav>
    </div>
  );
}

/** Anfangsbestand + Einnahmen − Ausgaben = Endbestand, read left to right. */
export function Ribbon({ items, meta }: { items: { label: string; value: string; strong?: boolean; op?: string }[]; meta?: string }) {
  return (
    <div className="flex flex-wrap items-stretch gap-y-2 rounded-xl border border-line bg-surface px-2 py-2">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center">
          {i > 0 && <span aria-hidden="true" className="px-2 text-lg text-muted">{it.op ?? ""}</span>}
          <div className={`rounded-lg px-3 py-1.5 ${it.strong ? "bg-white shadow-[0_0_0_1px_var(--line)]" : ""}`}>
            <p className="text-[11.5px] font-semibold text-muted">{it.label}</p>
            <p className={`num text-[17px] ${it.strong ? "font-bold" : "font-semibold"}`}>{it.value} €</p>
          </div>
        </div>
      ))}
      {meta && <p className="ml-auto self-center px-3 text-[12.5px] text-muted">{meta}</p>}
    </div>
  );
}

export function monthParam(sp: Record<string, string | undefined>) {
  return sp.m;
}

export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <p role="alert" className="rounded-lg bg-[#fde8e4] px-4 py-2.5 font-medium text-[#8a2a12]">{err}</p>;
  if (msg) return <p role="status" className="rounded-lg bg-forest/10 px-4 py-2.5 font-medium text-forest">{msg}</p>;
  return null;
}
