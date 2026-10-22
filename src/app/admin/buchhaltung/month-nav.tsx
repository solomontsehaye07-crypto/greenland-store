import Link from "next/link";
import { monthKey, shiftMonth } from "@/lib/cashbook";

const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** ← October 2026 → for the bookkeeping pages; keeps other query values (e.g. the view tab). */
export function MonthNav({ base, year, month, extra = "" }: { base: string; year: number; month: number; extra?: string }) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const future = next.year * 12 + next.month > now.getFullYear() * 12 + now.getMonth() + 1;
  return (
    <nav className="flex items-center gap-2" aria-label="Month">
      <Link href={`${base}?m=${monthKey(prev.year, prev.month)}${extra}`} className="btn btn-ghost !py-1.5" aria-label="Previous month">←</Link>
      <span className="min-w-36 text-center font-semibold">{NAMES[month - 1]} {year}</span>
      {!future && <Link href={`${base}?m=${monthKey(next.year, next.month)}${extra}`} className="btn btn-ghost !py-1.5" aria-label="Next month">→</Link>}
    </nav>
  );
}

export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <p role="alert" className="rounded-xl bg-[#fde8e4] px-4 py-3 text-sm font-medium text-[#8a2a12]">{err}</p>;
  if (msg) return <p role="status" className="rounded-xl bg-forest/10 px-4 py-3 text-sm font-medium text-forest">{msg}</p>;
  return null;
}

export function ExportLinks({ book, m, label }: { book: "shop" | "online"; m: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <a href={`/admin/buchhaltung/export?book=${book}&m=${m}&format=xlsx`} className="btn btn-ghost !py-1.5 text-sm">Excel</a>
      <a href={`/admin/buchhaltung/export?book=${book}&m=${m}&format=datev`} className="btn btn-ghost !py-1.5 text-sm">DATEV file</a>
    </div>
  );
}
