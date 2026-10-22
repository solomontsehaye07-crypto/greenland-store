"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Jahr / Monat dropdowns: switching reloads the book right away, like in Agenda. */
export function PeriodSelect({ year, month, years }: { year: number; month: number; years: number[] }) {
  const router = useRouter();
  const path = usePathname();
  const go = (y: number, mo: number) => router.push(`${path}?m=${y}-${String(mo).padStart(2, "0")}`);
  return (
    <>
      <select id="ps-y" value={year} onChange={(e) => go(Number(e.target.value), month)} className="stb-field !w-[5.5rem]">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <label htmlFor="ps-m" className="stb-label !mb-0 ml-auto pl-3">Monat</label>
      <select id="ps-m" value={month} onChange={(e) => go(year, Number(e.target.value))} className="stb-field !w-[8.5rem]">
        {MONATE.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
    </>
  );
}

/** Scrolls the grid to the selected line, or to the newest line at the bottom. */
export function GridScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const row = box.querySelector<HTMLElement>("tr.sel");
    if (row) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2);
    else box.scrollTop = box.scrollHeight;
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
