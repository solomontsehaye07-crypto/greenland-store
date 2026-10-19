"use client";

import { useRef } from "react";
import { Icon } from "../icons";

export function Rail({ children, labels }: { children: React.ReactNode; labels: { prev: string; next: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="rail">{children}</div>
      <div className="mt-4 hidden justify-end gap-2 sm:flex">
        <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className="grid h-11 w-11 place-items-center rounded-full border border-current opacity-80 hover:opacity-100"><Icon name="arrowL" /></button>
        <button type="button" onClick={() => go(1)} aria-label={labels.next} className="grid h-11 w-11 place-items-center rounded-full border border-current opacity-80 hover:opacity-100"><Icon name="arrowR" /></button>
      </div>
    </div>
  );
}
