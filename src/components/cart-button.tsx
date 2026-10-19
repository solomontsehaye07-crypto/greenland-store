"use client";

import { useCart } from "./cart";

export function CartButton({ label }: { label: string }) {
  const { count, ready, setDrawerOpen } = useCart();
  const n = ready ? count : 0;
  return (
    <button type="button" onClick={() => setDrawerOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface" aria-label={`${label}, ${n}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M5 8h14l-1.2 11.2a1 1 0 01-1 .8H7.2a1 1 0 01-1-.8z" />
        <path d="M9 8V6.5a3 3 0 016 0V8" />
      </svg>
      {n > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[0.625rem] font-semibold text-white">{n}</span>}
    </button>
  );
}
