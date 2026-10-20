"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteMedia } from "../actions";
import { uploadImages } from "@/components/admin/media-picker";
import { ConfirmButton } from "@/components/admin/website/confirm-button";

type F = { name: string; url: string; label: string; size?: number };
type Tab = "uploads" | "products";

const kb = (n?: number) => (!n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function MediaLibrary() {
  const input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("uploads");
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<F[] | null>(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [copied, setCopied] = useState("");

  const load = useCallback(async (t: Tab, query: string, p: number) => {
    const r = await fetch(`/admin/api/media?source=${t}&q=${encodeURIComponent(query)}&page=${p}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg({ error: j.error ?? "Could not load the media library." });
      setFiles([]);
      return;
    }
    setFiles((prev) => (p > 0 && prev ? [...prev, ...j.files] : j.files));
    setTotal(j.total ?? 0);
    setMore(!!j.more);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setFiles(null);
      load(tab, q, 0);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [tab, q, load]);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setMsg({});
    const r = await uploadImages(list);
    setBusy(false);
    setMsg({ ok: r.files.length ? `${r.files.length} ${r.files.length === 1 ? "image" : "images"} uploaded.` : undefined, error: r.errors.join(" ") || undefined });
    if (input.current) input.current.value = "";
    setTab("uploads");
    load("uploads", "", 0);
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-primary">{busy ? "Uploading…" : "Upload images"}</button>
        <p className="text-sm text-muted">or drag them here. JPG, PNG, WebP or SVG up to 8 MB each.</p>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <p className="w-full text-sm empty:hidden" role="status" aria-live="polite">
          {msg.ok && <span className="font-semibold text-forest">{msg.ok} </span>}
          {msg.error && <span className="text-danger">{msg.error}</span>}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="flex rounded-full bg-surface p-1 text-sm">
            {(["uploads", "products"] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 font-medium ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>
                {t === "uploads" ? "Your uploads" : "Product photos"}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "products" ? "Search product or SKU…" : "Search file name…"} className="input h-10 max-w-xs py-2 text-sm" />
          <span className="ml-auto text-xs text-muted">{files ? `${total} ${tab === "products" ? "products with photos" : "files"}` : ""}</span>
        </div>
        <div className="p-3">
          {!files && <p className="py-10 text-center text-sm text-muted">Loading…</p>}
          {files && !files.length && <p className="py-10 text-center text-sm text-muted">{q ? "Nothing matches that search." : "No uploads yet. Upload the first image above."}</p>}
          {files && files.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {files.map((f) => (
                <li key={f.name + f.url} className="overflow-hidden rounded-xl ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.label} loading="lazy" className="aspect-square w-full bg-white object-contain p-1" />
                  <div className="space-y-1.5 border-t border-line p-2">
                    <p className="truncate text-xs" title={f.label}>{f.label}{f.size ? <span className="text-muted"> · {kb(f.size)}</span> : null}</p>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(f.url);
                            setCopied(f.url);
                            setTimeout(() => setCopied(""), 2000);
                          } catch {
                            setCopied("");
                          }
                        }}
                        className="rounded-full px-2 py-1 text-xs font-semibold hover:bg-surface"
                      >
                        {copied === f.url ? "Copied" : "Copy link"}
                      </button>
                      {tab === "uploads" ? (
                        <form action={async (fd) => { await deleteMedia(fd); load("uploads", q, 0); }}>
                          <input type="hidden" name="name" value={f.name} />
                          <ConfirmButton label="Delete" confirmLabel="Sure?" />
                        </form>
                      ) : (
                        <Link href={`/admin/products?q=${encodeURIComponent(f.name.replace(/-\d+$/, ""))}`} className="rounded-full px-2 py-1 text-xs font-semibold hover:bg-surface">Product</Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {more && (
            <div className="mt-4 text-center">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => { const n = page + 1; setPage(n); load(tab, q, n); }}>Show more</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
