"use client";

import { useEffect, useState } from "react";

export type PickProduct = { id: number; title: string; title_de: string | null; sku: string; image_url: string | null; price: number; compare_at_price: number | null; stock: number; status: string };

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n));

/** Pick products by search and put them in order. `value` is the list of product ids. */
export function ProductPicker({ value, onChange, max = 24 }: { value: number[]; onChange: (ids: number[]) => void; max?: number }) {
  const [known, setKnown] = useState<Record<number, PickProduct>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // load details for already chosen products
  useEffect(() => {
    const missing = value.filter((id) => !known[id]);
    if (!missing.length) return;
    fetch(`/admin/api/products?ids=${missing.join(",")}`)
      .then((r) => r.json())
      .then((j) => setKnown((k) => ({ ...k, ...Object.fromEntries((j.products ?? []).map((p: PickProduct) => [p.id, p])) })))
      .catch(() => null);
  }, [value, known]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/admin/api/products?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(j.products ?? []);
        setKnown((k) => ({ ...k, ...Object.fromEntries((j.products ?? []).map((p: PickProduct) => [p.id, p])) }));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const row = (p: PickProduct | undefined, id: number) => (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p?.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-surface" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p ? p.title_de || p.title : `Product #${id}`}</span>
        <span className="block truncate text-xs text-muted">
          {p ? (
            <>
              {p.sku} · {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? <><s>{eur(p.compare_at_price)}</s> <b className="text-terra">{eur(p.price)}</b></> : eur(p.price)}
              {p.stock <= 0 ? " · out of stock" : ""}
              {p.status !== "active" ? " · hidden" : ""}
            </>
          ) : "Loading…"}
        </span>
      </span>
    </>
  );

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ol className="divide-y divide-line rounded-xl border border-line bg-white">
          {value.map((id, i) => (
            <li key={id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
              {row(known[id], id)}
              <div className="flex shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-2 py-1 text-sm hover:bg-surface disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded px-2 py-1 text-sm hover:bg-surface disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="rounded px-2 py-1 text-sm text-danger hover:bg-danger/10" aria-label="Remove">✕</button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">No products chosen yet. Search below and click a product to add it.</p>
      )}
      {value.length < max && (
        <div className="rounded-xl border border-line bg-paper p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name or SKU…" className="input h-10 py-2 text-sm" />
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {loading && !results.length && <li className="px-2 py-3 text-sm text-muted">Searching…</li>}
            {results.map((p) => {
              const chosen = value.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" disabled={chosen} onClick={() => onChange([...value, p.id])} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white disabled:opacity-40">
                    {row(p, p.id)}
                    <span className="shrink-0 text-xs font-semibold text-forest">{chosen ? "Added" : "Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
