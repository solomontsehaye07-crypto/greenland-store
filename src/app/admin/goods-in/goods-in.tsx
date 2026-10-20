"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ImageField } from "@/components/admin/media-picker";
import { bookGoodsIn, quickCreate, type Found } from "./actions";

type Line = Found & { qty: number; costIn: string; bbd: string };
const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const num = (s: string) => {
  const t = s.trim().replace(/\s|€/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

export function GoodsIn({ suppliers, categories, initialSupplier, initialProduct }: { suppliers: { id: number; name: string }[]; categories: { id: number; label: string }[]; initialSupplier: number | null; initialProduct: Found | null }) {
  const [supplier, setSupplier] = useState<number | null>(initialSupplier);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(initialProduct ? [{ ...initialProduct, qty: 1, costIn: initialProduct.cost != null ? String(initialProduct.cost).replace(".", ",") : "", bbd: "" }] : []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [after, setAfter] = useState<Record<number, number> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      const r = await fetch(`/admin/api/products?q=${encodeURIComponent(q.trim())}`);
      const j = await r.json().catch(() => ({}));
      setResults(((j.products ?? []) as { id: number; sku: string; title: string; title_de: string | null; image_url: string | null; stock: number; price: number }[]).map((p) => ({ id: p.id, sku: p.sku, title: p.title_de || p.title, image_url: p.image_url, stock: p.stock, cost: null, price: Number(p.price) })));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const add = (p: Found) => {
    setAfter(null);
    setMsg({});
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === p.id);
      if (i >= 0) return ls.map((l, x) => (x === i ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { ...p, qty: 1, costIn: p.cost != null ? String(p.cost).replace(".", ",") : "", bbd: "" }];
    });
    setQ("");
    setResults([]);
    searchRef.current?.focus();
  };
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (num(l.costIn) ?? 0) * l.qty, 0);
  const units = lines.reduce((s, l) => s + l.qty, 0);

  async function book() {
    setBusy(true);
    setMsg({});
    const r = await bookGoodsIn({
      supplierId: supplier,
      note: note || null,
      lines: lines.map((l) => ({ product_id: l.id, qty: l.qty, cost: num(l.costIn), best_before: l.bbd || null })),
    });
    setBusy(false);
    if (r.error) return setMsg({ error: r.error });
    setMsg({ ok: r.ok });
    setAfter(r.stock ?? {});
  }

  if (after) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-semibold text-forest" role="status">{msg.ok}</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2"><span>{l.title}</span><span>+{l.qty} → <b>{after[l.id] ?? "?"}</b> in stock</span></li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => { setLines([]); setAfter(null); setMsg({}); setNote(""); }}>Book another delivery</button>
          <Link href="/admin/products" className="btn btn-ghost">Back to products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="gi-sup">Supplier (optional)</label>
          <select id="gi-sup" value={supplier ?? ""} onChange={(e) => setSupplier(e.target.value ? Number(e.target.value) : null)} className="input">
            <option value="">No supplier / bought myself</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">With a supplier, the products are linked to it for future refill requests.</p>
        </div>
        <div>
          <label className="label" htmlFor="gi-note">Delivery note / invoice no. (optional)</label>
          <input id="gi-note" value={note} onChange={(e) => setNote(e.target.value)} className="input" />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <label className="label" htmlFor="gi-q">Find a product or scan its barcode</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="gi-q"
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) add(results[0]);
              }
            }}
            placeholder="Name, SKU or barcode…"
            className="input min-w-0 flex-1"
            autoFocus
          />
          <button type="button" onClick={() => setCreating(true)} className="btn btn-ghost">New product</button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain ring-1 ring-line" />
                  ) : (
                    <span className="h-9 w-9 rounded-lg bg-surface" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.title}</span>
                    <span className="block text-xs text-muted">{p.sku} · in stock {p.stock} · sells for {eur(p.price)}</span>
                  </span>
                  <span className="text-xs font-semibold text-forest">Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.trim().length > 2 && !results.length && (
          <p className="mt-2 text-sm text-muted">Nothing found. <button type="button" onClick={() => setCreating(true)} className="font-medium text-forest underline">Create “{q.trim()}” as a new product</button></p>
        )}
        {creating && (
          <NewProductForm
            name={q.trim()}
            categories={categories}
            supplierId={supplier}
            onCancel={() => setCreating(false)}
            onCreated={(p) => {
              setCreating(false);
              add(p);
            }}
          />
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">This delivery <span className="font-normal text-muted">· {lines.length} products, {units} items{total ? ` · ${eur(total)} net` : ""}</span></div>
        {lines.length ? (
          <ul className="divide-y divide-line">
            {lines.map((l, i) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted">{l.sku} · now {l.stock} → after booking <b>{l.stock + l.qty}</b></p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => set(i, { qty: Math.max(1, l.qty - 1) })} className="grid h-8 w-8 place-items-center rounded-full border border-line" aria-label="Less">−</button>
                  <input type="number" min={1} value={l.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className="input h-8 w-16 px-2 py-1 text-center text-sm" aria-label="Quantity" />
                  <button type="button" onClick={() => set(i, { qty: l.qty + 1 })} className="grid h-8 w-8 place-items-center rounded-full border border-line" aria-label="More">+</button>
                </div>
                <label className="flex items-center gap-1 text-xs text-muted">Cost €<input value={l.costIn} onChange={(e) => set(i, { costIn: e.target.value })} inputMode="decimal" placeholder="net" className="input h-8 w-20 px-2 py-1 text-right text-sm" /></label>
                <label className="flex items-center gap-1 text-xs text-muted">Best before<input type="date" value={l.bbd} onChange={(e) => set(i, { bbd: e.target.value })} className="input h-8 w-36 px-2 py-1 text-sm" /></label>
                <button type="button" onClick={() => setLines(lines.filter((_, x) => x !== i))} className="rounded-full px-2 py-1 text-sm text-danger hover:bg-danger/10" aria-label="Remove">✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">Search or scan above to add the first product.</p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <button type="button" onClick={book} disabled={busy || !lines.length} className="btn btn-primary">{busy ? "Booking…" : `Add ${units} items to stock`}</button>
          {msg.error && <span className="text-sm text-danger" role="alert">{msg.error}</span>}
        </div>
      </div>
    </div>
  );
}

function NewProductForm({ name, categories, supplierId, onCancel, onCreated }: { name: string; categories: { id: number; label: string }[]; supplierId: number | null; onCancel: () => void; onCreated: (p: Found) => void }) {
  const [f, setF] = useState({ title_de: name, title: "", brand: "", ean: /^\d{8,14}$/.test(name) ? name : "", category_id: "", price: "", tax_rate: "7", cost: "", image: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-forest/40 bg-paper p-4">
      <p className="text-sm font-semibold">New product</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="np-de">Name (German) *</label><input id="np-de" value={f.title_de} onChange={set("title_de")} className="input" /></div>
        <div><label className="label" htmlFor="np-en">Name (English)</label><input id="np-en" value={f.title} onChange={set("title")} className="input" /></div>
        <div><label className="label" htmlFor="np-brand">Brand</label><input id="np-brand" value={f.brand} onChange={set("brand")} className="input" /></div>
        <div><label className="label" htmlFor="np-ean">Barcode (EAN)</label><input id="np-ean" value={f.ean} onChange={set("ean")} inputMode="numeric" className="input" /></div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="np-cat">Category *</label>
          <select id="np-cat" value={f.category_id} onChange={set("category_id")} className="input">
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="np-price">Selling price € (incl. VAT) *</label><input id="np-price" value={f.price} onChange={set("price")} inputMode="decimal" className="input" /></div>
        <div>
          <label className="label" htmlFor="np-vat">VAT</label>
          <select id="np-vat" value={f.tax_rate} onChange={set("tax_rate")} className="input"><option value="7">7 % (food)</option><option value="19">19 %</option></select>
        </div>
        <div><label className="label" htmlFor="np-cost">Purchase cost € (net)</label><input id="np-cost" value={f.cost} onChange={set("cost")} inputMode="decimal" className="input" /></div>
      </div>
      <div><span className="label">Photo</span><ImageField value={f.image} onChange={(v) => setF((x) => ({ ...x, image: v }))} /></div>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn btn-primary"
          onClick={async () => {
            setBusy(true);
            setErr("");
            const r = await quickCreate({
              title_de: f.title_de,
              title: f.title || undefined,
              brand: f.brand || null,
              ean: f.ean || null,
              category_id: Number(f.category_id) || null,
              price: num(f.price) ?? 0,
              tax_rate: Number(f.tax_rate),
              cost_price: num(f.cost),
              image_url: f.image || null,
              supplier_id: supplierId,
            });
            setBusy(false);
            if (r.error || !r.product) return setErr(r.error ?? "Could not create the product.");
            onCreated(r.product);
          }}
        >
          {busy ? "Creating…" : "Create and add to delivery"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
      <p className="text-xs text-muted">You can add more photos and descriptions later in Products.</p>
    </div>
  );
}
