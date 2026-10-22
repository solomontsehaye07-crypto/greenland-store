"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/types";
import { lineUnit, tierPct, type TierConfig } from "@/lib/tiers";

interface CartCtx {
  lines: CartLine[];
  count: number;
  /** what the goods cost after quantity discounts */
  subtotal: number;
  /** before any discount */
  listSubtotal: number;
  /** price per unit of a line after its quantity discount, and the percentage */
  unitOf: (l: CartLine) => { unit: number; pct: number };
  tiers: TierConfig | null;
  setTiers: (t: TierConfig | null) => void;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  ready: boolean;
  /** The slide-in cart panel */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "greenland.cart.v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tiers, setTiers] = useState<TierConfig | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* storage unavailable – cart lives in memory */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((ls) => {
      const found = ls.find((l) => l.id === line.id);
      if (found) return ls.map((l) => (l.id === line.id ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...ls, { ...line, qty }];
    });
  }, []);
  const setQty = useCallback(
    (id: number, qty: number) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty } : l)))),
    []
  );
  const remove = useCallback((id: number) => setLines((ls) => ls.filter((l) => l.id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const unitOf = useCallback((l: CartLine) => {
    const r = lineUnit(l.price, l.qty, tiers, l.qd !== false);
    return { unit: r.unit, pct: tierPct(l.qty, tiers, l.qd !== false) };
  }, [tiers]);

  const value = useMemo(
    () => ({
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: Math.round(lines.reduce((s, l) => s + l.qty * unitOf(l).unit, 0) * 100) / 100,
      listSubtotal: Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100,
      unitOf,
      tiers,
      setTiers,
      add,
      setQty,
      remove,
      clear,
      drawerOpen,
      setDrawerOpen,
    }),
    [lines, ready, add, setQty, remove, clear, drawerOpen, unitOf, tiers]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

/** Hands the shop's quantity-discount tiers (from the server) to the cart. */
export function CartTiers({ tiers }: { tiers: TierConfig | null }) {
  const { setTiers } = useCart();
  const key = JSON.stringify(tiers);
  useEffect(() => {
    setTiers(tiers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setTiers]);
  return null;
}
