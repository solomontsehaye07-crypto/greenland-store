"use client";

import Link from "next/link";
import { useCart } from "./cart";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="relative flex h-11 items-center gap-2 rounded-full bg-green px-4 text-white hover:bg-green-deep" aria-label={`Cart, ${count} items`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 7h14l-1.5 11h-11z" />
        <path d="M9 7a3 3 0 016 0" />
      </svg>
      <span className="text-sm font-semibold">{ready ? count : 0}</span>
    </Link>
  );
}
