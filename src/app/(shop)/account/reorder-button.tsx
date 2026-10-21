"use client";

import { useState } from "react";
import { useCart } from "@/components/cart";
import type { CartLine } from "@/lib/types";

/** Puts every product of an earlier order back into the cart (skips what is no longer sold). */
export function ReorderButton({ orderId, label, done }: { orderId: string; label: string; done: string }) {
  const { add, setDrawerOpen } = useCart();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch(`/api/reorder?order=${orderId}`, { credentials: "same-origin" });
            const d = (await r.json()) as { lines: (Omit<CartLine, "qty"> & { qty: number })[]; missing: number };
            for (const l of d.lines) add(l, l.qty);
            setNote(d.missing ? `${done} (${d.missing} not available any more)` : done);
            setDrawerOpen(true);
          } catch {
            setNote("Could not load this order.");
          } finally {
            setBusy(false);
          }
        }}
        className="btn btn-primary h-10 px-4 text-sm"
      >
        {busy ? "…" : label}
      </button>
      {note && <p className="mt-1 text-xs text-forest" role="status">{note}</p>}
    </div>
  );
}
