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

/** Keeps the chosen month visible in the month strip on narrow screens. */
export function StripScroll({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = ref.current;
    const cur = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (box && cur) box.scrollLeft = cur.offsetLeft - box.clientWidth / 2 + cur.clientWidth / 2;
  }, []);
  return <nav ref={ref} aria-label={label} className={className}>{children}</nav>;
}

/** Escape closes the edit sheet on tablets/phones. */
export function EscClose({ href }: { href: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") window.location.assign(href); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [href]);
  return null;
}
