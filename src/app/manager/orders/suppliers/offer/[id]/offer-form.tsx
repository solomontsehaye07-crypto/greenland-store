"use client";

import { useMemo, useState } from "react";
import { acceptOfferAction, saveOfferAction } from "../../../../actions";

export type OfferLine = {
  id: number;
  title: string;
  qty: number;
  offer: number | null;
  available: boolean | null;
  note: string | null;
  ordered: boolean;
  lastCost: number | null; // what we paid last time
  sell: number | null; // our shop price (gross)
  tax: number; // % VAT
};

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const num = (s: string) => {
  const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
};

// Compare the supplier's prices with what we paid before and what we sell for, then tick what to order.
export function OfferForm({ poId, lines, locked }: { poId: number; lines: OfferLine[]; locked: boolean }) {
  const [rows, setRows] = useState(() =>
    lines.map((l) => ({ ...l, price: l.offer != null ? String(l.offer).replace(".", ",") : "", q: String(l.qty), take: l.ordered && l.available !== false }))
  );
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const total = useMemo(() => rows.reduce((t, r) => t + (r.take ? (num(r.price) ?? 0) * (Number(r.q) || 0) : 0), 0), [rows]);
  const taken = rows.filter((r) => r.take).length;
  const missing = rows.filter((r) => r.take && num(r.price) == null).length;

  return (
    <form className="space-y-3">
      <input type="hidden" name="po_id" value={poId} />
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const p = num(r.price);
          const net = r.sell != null ? r.sell / (1 + r.tax / 100) : null;
          const margin = p != null && net ? ((net - p) / net) * 100 : null;
          const vsLast = p != null && r.lastCost ? ((p - r.lastCost) / r.lastCost) * 100 : null;
          return (
            <li key={r.id} className={`rounded-2xl border-2 bg-white p-3 ${r.take ? "border-line" : "border-dashed border-line opacity-70"}`}>
              <div className="flex items-start gap-3">
                <label className="flex min-h-11 flex-1 items-start gap-3">
                  <input type="checkbox" name={`ordered_${r.id}`} checked={r.take} disabled={locked} onChange={(e) => set(i, { take: e.target.checked })} className="mt-1 h-6 w-6 shrink-0 accent-[var(--forest,#1D5C3F)]" aria-label={`Order ${r.title}`} />
                  <span className="text-[0.9375rem] font-medium leading-snug" data-no-translate>{r.title}</span>
                </label>
              </div>
              {r.available === false && <p className="mt-1 text-sm font-semibold text-terra">Supplier: not available</p>}
              {r.note && <p className="mt-1 text-sm text-muted">Supplier: “<span data-no-translate>{r.note}</span>”</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor={`price-${r.id}`}>Their price / unit (€)</label>
                  <input id={`price-${r.id}`} name={`price_${r.id}`} value={r.price} disabled={locked} onChange={(e) => set(i, { price: e.target.value })} inputMode="decimal" placeholder="—" data-no-memory className="input text-lg font-bold tabular-nums" />
                </div>
                <div>
                  <label className="label" htmlFor={`qty-${r.id}`}>Quantity</label>
                  <input id={`qty-${r.id}`} name={`qty_${r.id}`} value={r.q} disabled={locked} onChange={(e) => set(i, { q: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" data-no-memory className="input text-lg font-bold tabular-nums" />
                </div>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {r.lastCost != null && (
                  <span>
                    Last time {eur(r.lastCost)}
                    {vsLast != null && Math.abs(vsLast) >= 0.5 && <b className={vsLast > 0 ? "text-terra" : "text-forest"}> ({vsLast > 0 ? "+" : ""}{vsLast.toFixed(0)} %)</b>}
                  </span>
                )}
                {r.sell != null && <span>You sell for {eur(r.sell)}</span>}
                {margin != null && <b className={margin < 20 ? "text-terra" : "text-forest"}>Margin {margin.toFixed(0)} %</b>}
                {p != null && <span>Line {eur(p * (Number(r.q) || 0))}</span>}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="rounded-2xl bg-surface p-4">
        <p className="text-base font-bold">{taken} of {rows.length} products · {eur(total)} net</p>
        {missing > 0 && <p className="mt-1 text-sm text-terra">{missing} ticked product{missing > 1 ? "s have" : " has"} no price yet.</p>}
        <p className="mt-1 text-xs text-muted">Margin = your shop price without VAT compared with their price. Under 20 % is shown in red.</p>
      </div>

      {!locked && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button formAction={saveOfferAction} className="btn btn-ghost min-h-12">Save prices</button>
          <button formAction={acceptOfferAction} disabled={!taken} className="btn btn-primary min-h-12">Accept & order the ticked ones</button>
        </div>
      )}
    </form>
  );
}
