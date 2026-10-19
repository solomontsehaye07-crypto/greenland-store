"use client";

import { useRef } from "react";
import { Icon } from "../icons";

export function Rail({ children, labels }: { children: React.ReactNode; labels: { prev: string; next: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="group/rail relative">
      <div ref={ref} className="rail">{children}</div>
      <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className="absolute -left-3 top-[34%] hidden h-9 w-9 place-items-center rounded-full border border-line bg-white opacity-0 shadow-sm transition-opacity group-hover/rail:opacity-100 focus-visible:opacity-100 lg:grid"><Icon name="arrowL" size={16} /></button>
      <button type="button" onClick={() => go(1)} aria-label={labels.next} className="absolute -right-3 top-[34%] hidden h-9 w-9 place-items-center rounded-full border border-line bg-white opacity-0 shadow-sm transition-opacity group-hover/rail:opacity-100 focus-visible:opacity-100 lg:grid"><Icon name="arrowR" size={16} /></button>
    </div>
  );
}
