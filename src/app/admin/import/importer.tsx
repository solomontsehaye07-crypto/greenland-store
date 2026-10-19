"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { runImport, type ImportKind, type ImportResult } from "./actions";

const FIELDS: Record<ImportKind, { key: string; label: string; required?: boolean }[]> = {
  products: [
    { key: "sku", label: "SKU", required: true },
    { key: "title", label: "Title" },
    { key: "price", label: "Price (gross €)" },
    { key: "category", label: "Category (slug or name)" },
    { key: "brand", label: "Brand" },
    { key: "cost_price", label: "Cost price (net €)" },
    { key: "supplier", label: "Supplier name" },
    { key: "stock", label: "Stock on hand" },
    { key: "reorder_point", label: "Reorder point" },
    { key: "weight_g", label: "Weight (g)" },
    { key: "image_url", label: "Image URL" },
    { key: "description", label: "Description" },
  ],
  stock: [
    { key: "sku", label: "SKU", required: true },
    { key: "qty", label: "Quantity", required: true },
    { key: "mode", label: "Mode: set (count) or add (delivery)" },
    { key: "best_before", label: "Best before (31.12.2026)" },
    { key: "lot", label: "Lot / batch code" },
  ],
  prices: [
    { key: "sku", label: "SKU", required: true },
    { key: "price", label: "New price (gross €)" },
    { key: "cost_price", label: "Cost price (net €)" },
  ],
  supplier_prices: [
    { key: "sku", label: "Our SKU", required: true },
    { key: "supplier", label: "Supplier name", required: true },
    { key: "supplier_sku", label: "Supplier article no." },
    { key: "cost_price", label: "Cost price (net €)" },
    { key: "pack_size", label: "Pack size" },
  ],
};

const KIND_LABEL: Record<ImportKind, string> = {
  products: "Products (create or update)",
  stock: "Stock counts and deliveries",
  prices: "Price list",
  supplier_prices: "Supplier price list",
};

export function Importer() {
  const [kind, setKind] = useState<ImportKind>("stock");
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [file, setFile] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f: File) {
    setResult(null);
    setError(null);
    setFile(f.name);
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    const hs = rows.length ? Object.keys(rows[0]) : [];
    setHeaders(hs);
    setRaw(rows);
    // auto-map by similar names
    const auto: Record<string, string> = {};
    for (const fld of Object.values(FIELDS).flat()) {
      const hit = hs.find((h) => h.toLowerCase().replace(/[^a-z]/g, "") === fld.key.replace(/_/g, "") || h.toLowerCase().includes(fld.key.replace("_", " ")));
      if (hit) auto[fld.key] = hit;
    }
    setMap(auto);
  }

  const mapped = () => raw.map((r) => Object.fromEntries(Object.entries(map).filter(([, h]) => h).map(([k, h]) => [k, r[h] as string])));

  async function go(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      setResult(await runImport(kind, mapped(), apply, file));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const missing = FIELDS[kind].filter((f) => f.required && !map[f.key]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">What are you importing?</label>
          <select id="kind" className="input" value={kind} onChange={(e) => { setKind(e.target.value as ImportKind); setResult(null); }}>
            {(Object.keys(FIELDS) as ImportKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="file">CSV or Excel file</label>
          <input id="file" type="file" accept=".csv,.xlsx,.xls,.numbers" className="input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      </div>

      {headers.length > 0 && (
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Match your columns</h2>
          <p className="text-sm text-muted">{raw.length} rows found in {file}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS[kind].map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}{f.required ? " *" : ""}</label>
                <select className="input" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">— not in file —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn btn-ghost" disabled={busy || missing.length > 0} onClick={() => go(false)}>
              {busy ? "Checking…" : "Preview changes"}
            </button>
            {result && !result.applied && result.create + result.update > 0 && (
              <button className="btn btn-primary" disabled={busy} onClick={() => go(true)}>
                Apply {result.create + result.update} changes
              </button>
            )}
          </div>
          {missing.length > 0 && <p className="mt-2 text-sm text-danger">Map the required column(s): {missing.map((m) => m.label).join(", ")}</p>}
        </div>
      )}

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {result && (
        <div className="rounded-2xl bg-white p-5">
          <p className="font-semibold">
            {result.applied ? "Imported." : "Preview – nothing saved yet."} {result.create} new, {result.update} updates, {result.skipped} unchanged, {result.errors.length} errors.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-auto text-sm text-danger">
              {result.errors.map((e) => (
                <li key={e.row}>Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
          <table className="table mt-4">
            <thead><tr><th>Row</th><th>SKU</th><th>Action</th><th>Change</th></tr></thead>
            <tbody>
              {result.preview.map((p) => (
                <tr key={p.row}><td>{p.row}</td><td>{p.sku}</td><td>{p.action}</td><td>{p.changes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
