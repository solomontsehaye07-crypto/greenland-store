"use client";

import { useEffect, useRef } from "react";

/** Scrolls the grid to the selected line, or to the newest line at the bottom. */
export function GridScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const row = box.querySelector<HTMLElement>("tr.sel");
    box.scrollTop = row ? Math.max(0, row.offsetTop - box.clientHeight / 2) : box.scrollHeight;
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
