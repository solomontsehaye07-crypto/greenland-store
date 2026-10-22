import Link from "next/link";
import { monthKey, shiftMonth } from "@/lib/cashbook";
import { StripScroll } from "./client";

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
        <h1 className="display text-xl font-bold sm:text-2xl">{title} <span className="whitespace-nowrap font-normal text-muted">{MONATE[month - 1]} {year}</span></h1>
        {book && (
          <div className="flex w-full gap-2 sm:w-auto">
            <a href={`/steuerberater/export?book=${book}&m=${m}&format=xlsx`} className="stb-btn flex-1 justify-center sm:flex-none">Excel<span className="hidden sm:inline"> herunterladen</span></a>
            <a href={`/steuerberater/export?book=${book}&m=${m}&format=datev`} className="stb-btn flex-1 justify-center sm:flex-none">DATEV-Stapel</a>
          </div>
        )}
      </div>
      <StripScroll label="Monat wählen" className="stb-months flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 [scrollbar-width:none]">
        <Link href={`${base}?m=${monthKey(prev.year, prev.month)}`} aria-label={`Jahr ${year - 1}`} className="!min-w-0 whitespace-nowrap px-3 text-muted">‹ {year - 1}</Link>
        <span className="px-2 font-bold">{year}</span>
        {KURZ.map((k, i) => (
          <Link key={k} href={`${base}?m=${monthKey(year, i + 1)}`} aria-current={i + 1 === month ? "true" : undefined} aria-label={`${MONATE[i]} ${year}`} className={year * 12 + i + 1 > cur ? "future" : ""}>{k}</Link>
        ))}
        {(year + 1) * 12 + 1 <= cur && <Link href={`${base}?m=${monthKey(year + 1, 1)}`} aria-label={`Jahr ${year + 1}`} className="!min-w-0 whitespace-nowrap px-3 text-muted">{year + 1} ›</Link>}
      </StripScroll>
    </div>
  );
}

/** Anfangsbestand + Einnahmen − Ausgaben = Endbestand, read left to right. */
export function Ribbon({ items, meta }: { items: { label: string; value: string; strong?: boolean; op?: string }[]; meta?: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-2 sm:flex sm:flex-wrap sm:items-stretch sm:gap-0 sm:gap-y-2">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center">
          {i > 0 && <span aria-hidden="true" className="hidden px-2 text-lg text-muted sm:inline">{it.op ?? ""}</span>}
          <div className={`rounded-lg px-3 py-1.5 ${it.strong ? "bg-white shadow-[0_0_0_1px_var(--line)]" : ""}`}>
            <p className="text-[11.5px] font-semibold text-muted">{it.label}</p>
            <p className={`num text-[16px] sm:text-[17px] ${it.strong ? "font-bold" : "font-semibold"}`}>{it.op && it.op !== "=" ? <span className="text-muted sm:hidden">{it.op} </span> : null}{it.value} €</p>
          </div>
        </div>
      ))}
      {meta && <p className="col-span-2 px-3 pt-1 text-[12.5px] text-muted sm:ml-auto sm:self-center sm:pt-0">{meta}</p>}
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
