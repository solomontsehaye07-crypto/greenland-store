"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { savePo, type PoDraft, type PoLine } from "../actions";

export type ProdInfo = { id: number; sku: string; title: string; image_url: string | null; stock: number; cost: number | null; reorder_qty?: number };
export type Insight = { product_id: number; sku: string; title: string; image_url: string | null; stock: number; reorder_point: number; reorder_qty: number; cost: number | null; times: number; qty: number; last: string | null };

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const daysAgo = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const ago = (iso: string | null) => {
  const d = daysAgo(iso);
  if (d === null) return "never ordered";
  if (d === 0) return "ordered today";
  if (d < 60) return `ordered ${d} days ago`;
  return `ordered ${Math.round(d / 30)} months ago`;
};

type Tab = "low" | "most" | "recent" | "stale" | "all" | "search";
const TABS: [Tab, string][] = [
  ["low", "Running low"],
  ["most", "Most ordered"],
  ["recent", "Recently ordered"],
  ["stale", "Not ordered for a while"],
  ["all", "All from this supplier"],
  ["search", "Search all products"],
];

export function PoEditor({ poId, initial, products, insights, editable, sentBefore }: { poId: number; initial: PoDraft; products: Record<number, ProdInfo>; insights: Insight[]; editable: boolean; sentBefore: boolean }) {
  const [draft, setDraft] = useState<PoDraft>(initial);
  const [info, setInfo] = useState<Record<number, ProdInfo>>(products);
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>(insights.some((i) => i.stock <= i.reorder_point) ? "low" : insights.length ? "most" : "search");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ProdInfo[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  latest.current = draft;

  const change = (next: PoDraft) => {
    if (!editable) return;
    setDraft(next);
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  };

  async function save() {
    setState("saving");
    const r = await savePo(poId, latest.current);
    if (r.error) {
      setErr(r.error);
      setState("error");
      return;
    }
    // new lines get their ids back so later edits update them
    if (r.items) {
      const ids = r.items;
      setDraft((d) => ({
        ...d,
        items: d.items.map((l) => (l.id ? l : { ...l, id: ids.find((x) => x.product_id === l.product_id && !d.items.some((y) => y.id === x.id))?.id })),
      }));
    }
    setErr("");
    setState("saved");
    setVersion((v) => v + 1);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === "dirty" || state === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  useEffect(() => {
    if (tab !== "search") return;
    const t = setTimeout(async () => {
      const r = await fetch(`/admin/api/products?q=${encodeURIComponent(q)}`);
      const j = await r.json().catch(() => ({}));
      setFound(((j.products ?? []) as { id: number; sku: string; title: string; title_de: string | null; image_url: string | null; stock: number }[]).map((p) => ({ id: p.id, sku: p.sku, title: p.title_de || p.title, image_url: p.image_url, stock: p.stock, cost: null })));
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab]);

  const inOrder = new Set(draft.items.map((l) => l.product_id));
  const list = useMemo(() => {
    const L = [...insights];
    if (tab === "low") return L.filter((i) => i.stock <= i.reorder_point).sort((a, b) => a.stock - b.stock);
    if (tab === "most") return L.filter((i) => i.times > 0).sort((a, b) => b.times - a.times || b.qty - a.qty);
    if (tab === "recent") return L.filter((i) => i.last).sort((a, b) => String(b.last).localeCompare(String(a.last)));
    if (tab === "stale") return L.filter((i) => (daysAgo(i.last) ?? 9999) >= 45).sort((a, b) => String(a.last ?? "").localeCompare(String(b.last ?? "")));
    if (tab === "all") return L.sort((a, b) => a.title.localeCompare(b.title));
    return [];
  }, [insights, tab]);

  const add = (p: ProdInfo, qty: number) => {
    setInfo((i) => ({ ...i, [p.id]: p }));
    change({ ...draft, items: [...draft.items, { product_id: p.id, qty: Math.max(1, qty), unit_cost: p.cost, note: null }] });
  };
  const setLine = (idx: number, patch: Partial<PoLine>) => change({ ...draft, items: draft.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)) });
  const total = draft.items.reduce((s, l) => s + (Number(l.unit_cost) || 0) * l.qty, 0);
  const units = draft.items.reduce((s, l) => s + l.qty, 0);

  const statusText = { idle: "", dirty: "Unsaved changes…", saving: "Saving…", saved: "Saved · preview updated", error: err }[state];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-5">
        {/* lines */}
        <section className="rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-[0.9375rem] font-semibold">Items <span className="font-normal text-muted">· {draft.items.length} lines, {units} units{total > 0 ? ` · ${eur(total)} net` : ""}</span></h2>
            <span className={`text-xs ${state === "error" ? "text-danger" : "text-muted"}`} role="status" aria-live="polite">{statusText}</span>
          </div>
          {draft.items.length ? (
            <ul className="divide-y divide-line">
              {draft.items.map((l, i) => {
                const p = info[l.product_id];
                return (
                  <li key={l.id ?? `n${l.product_id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-lg bg-surface" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p?.title ?? `Product #${l.product_id}`}</p>
                      <p className="text-xs text-muted">{p?.sku} · in stock {p?.stock ?? "?"}</p>
                      {editable && (
                        <input value={l.note ?? ""} onChange={(e) => setLine(i, { note: e.target.value })} placeholder="Note for the supplier (optional)" className="mt-1 w-full border-0 border-b border-dashed border-line bg-transparent px-0 py-0.5 text-xs focus:border-forest focus:outline-none focus:ring-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={!editable} onClick={() => setLine(i, { qty: Math.max(1, l.qty - 1) })} className="grid h-8 w-8 place-items-center rounded-full border border-line hover:border-ink disabled:opacity-30" aria-label="Less">−</button>
                      <input type="number" min={1} value={l.qty} disabled={!editable} onChange={(e) => setLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className="input h-8 w-16 px-2 py-1 text-center text-sm" aria-label="Quantity" />
                      <button type="button" disabled={!editable} onClick={() => setLine(i, { qty: l.qty + 1 })} className="grid h-8 w-8 place-items-center rounded-full border border-line hover:border-ink disabled:opacity-30" aria-label="More">+</button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted">
                      €
                      <input inputMode="decimal" disabled={!editable} value={l.unit_cost ?? ""} onChange={(e) => setLine(i, { unit_cost: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} placeholder="cost" className="input h-8 w-20 px-2 py-1 text-right text-sm" aria-label="Unit cost" />
                    </label>
                    {editable && (
                      <button type="button" onClick={() => change({ ...draft, items: draft.items.filter((_, x) => x !== i) })} className="rounded-full px-2 py-1 text-sm text-danger hover:bg-danger/10" aria-label="Remove line">✕</button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted">No items yet. Add products from the suggestions below.</p>
          )}
        </section>

        {/* add products */}
        {editable && (
          <section className="rounded-2xl border border-line bg-white">
            <div className="flex gap-1 overflow-x-auto border-b border-line p-2">
              {TABS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${tab === k ? "bg-ink text-white" : "hover:bg-surface"}`}>{l}</button>
              ))}
            </div>
            {tab === "search" && (
              <div className="px-3 pt-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any product by name, SKU or barcode…" className="input h-10 py-2 text-sm" autoFocus />
              </div>
            )}
            <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
              {(tab === "search" ? found.map((p) => ({ p, sub: `${p.sku} · in stock ${p.stock}`, qty: 6 })) : list.map((i) => ({
                p: { id: i.product_id, sku: i.sku, title: i.title, image_url: i.image_url, stock: i.stock, cost: i.cost } as ProdInfo,
                sub: `${i.sku} · in stock ${i.stock}${i.times ? ` · ${i.times}× ordered, ${i.qty} units` : ""} · ${ago(i.last)}`,
                qty: i.times ? Math.max(1, Math.round(i.qty / i.times)) : Math.max(1, i.reorder_qty + i.reorder_point - i.stock),
              }))).map(({ p, sub, qty }) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" loading="lazy" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-surface" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.title}</p>
                    <p className="truncate text-xs text-muted">{sub}</p>
                  </div>
                  <button type="button" disabled={inOrder.has(p.id)} onClick={() => add(p, qty)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-forest hover:text-forest disabled:opacity-40">
                    {inOrder.has(p.id) ? "Added" : `Add ${qty}`}
                  </button>
                </li>
              ))}
              {tab !== "search" && !list.length && (
                <li className="px-4 py-6 text-center text-sm text-muted">
                  {insights.length ? "Nothing in this list." : "No products are linked to this supplier yet. Use Search, or set the supplier on products (product → stock & supplier)."}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* PDF options */}
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <h2 className="text-[0.9375rem] font-semibold">On the PDF and in the message</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="po-exp">Requested delivery</label>
              <input id="po-exp" type="date" disabled={!editable} value={draft.expected_at ?? ""} onChange={(e) => change({ ...draft, expected_at: e.target.value || null })} className="input" />
            </div>
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" disabled={!editable} checked={draft.show_prices} onChange={(e) => change({ ...draft, show_prices: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />
              Show my purchase prices on the PDF
            </label>
          </div>
          <div>
            <label className="label" htmlFor="po-notes">Notes on the PDF</label>
            <textarea id="po-notes" rows={3} disabled={!editable} value={draft.notes ?? ""} onChange={(e) => change({ ...draft, notes: e.target.value })} placeholder="e.g. Please deliver before 10 am. Call 30 min before arriving." className="input" />
          </div>
          <div>
            <label className="label" htmlFor="po-msg">Message with the PDF (email / WhatsApp)</label>
            <textarea id="po-msg" rows={4} disabled={!editable} value={draft.message ?? ""} onChange={(e) => change({ ...draft, message: e.target.value })} placeholder="Leave empty for the standard greeting." className="input" />
          </div>
          {sentBefore && editable && <p className="text-xs text-muted">This request was already sent. After changing it, send it again so the supplier has the new version; the earlier PDFs stay in the archive.</p>}
        </section>
      </div>

      {/* live preview */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Live preview</span>
            <a href={`/admin/purchase-orders/${poId}/pdf?v=${version}`} target="_blank" rel="noopener" className="text-xs font-medium text-forest underline">Open full size</a>
          </div>
          <iframe key={version} title="PDF preview" src={`/admin/purchase-orders/${poId}/pdf?v=${version}#view=FitH&toolbar=0`} className="h-[70vh] w-full bg-surface" />
        </div>
      </aside>
    </div>
  );
}
