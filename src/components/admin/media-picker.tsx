"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaFile = { name: string; url: string; label?: string; size?: number };

/** Uploads images to the media library. Used by every image field and the Media page. */
export async function uploadImages(files: FileList | File[]): Promise<{ files: MediaFile[]; errors: string[] }> {
  const fd = new FormData();
  for (const f of Array.from(files)) fd.append("file", f);
  try {
    const res = await fetch("/admin/website/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    return { files: j.files ?? [], errors: j.errors ?? (res.ok ? [] : [j.error ?? "Upload failed."]) };
  } catch {
    return { files: [], errors: ["Upload failed. Check your connection and try again."] };
  }
}

type Tab = "uploads" | "products";

/**
 * The media library as a dialog: your uploads and every product photo, searchable.
 * `multiple` lets you tick several photos and add them in one go.
 */
export function MediaDialog({ onPick, onClose, multiple = false, initialTab = "uploads" }: { onPick: (urls: string[]) => void; onClose: () => void; multiple?: boolean; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (t: Tab, query: string, p: number) => {
      setErr("");
      try {
        const r = await fetch(`/admin/api/media?source=${t}&q=${encodeURIComponent(query)}&page=${p}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load images.");
        setFiles((prev) => (p > 0 && prev ? [...prev, ...j.files] : j.files));
        setMore(!!j.more);
      } catch (e) {
        setErr((e as Error).message);
        setFiles([]);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setFiles(null);
      load(tab, q, 0);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [tab, q, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (url: string) => {
    if (!multiple) return onPick([url]);
    setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : [...p, url]));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close media library" onClick={onClose} />
      <div role="dialog" aria-label="Media library" className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="mr-auto text-base font-semibold">Media library</h2>
          <div className="flex rounded-full bg-surface p-1 text-sm">
            {(["uploads", "products"] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 font-medium ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>
                {t === "uploads" ? "Your uploads" : "Product photos"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "products" ? "Search product, SKU…" : "Search file name…"} className="input h-10 max-w-xs py-2 text-sm" autoFocus />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost h-10 py-2 text-sm">{busy ? "Uploading…" : "Upload new"}</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              setBusy(true);
              const r = await uploadImages(e.target.files);
              setBusy(false);
              e.target.value = "";
              if (r.errors.length) setErr(r.errors.join(" "));
              if (r.files.length) {
                if (!multiple) return onPick([r.files[0].url]);
                setPicked((p) => [...p, ...r.files.map((f) => f.url)]);
                setTab("uploads");
                load("uploads", "", 0);
              }
            }}
          />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!files && <p className="py-10 text-center text-sm text-muted">Loading…</p>}
          {files && !files.length && <p className="py-10 text-center text-sm text-muted">{q ? "Nothing matches that search." : "No images yet. Upload the first one."}</p>}
          {files && files.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {files.map((f) => {
                const sel = picked.includes(f.url);
                return (
                  <li key={f.name + f.url}>
                    <button type="button" onClick={() => choose(f.url)} title={f.label} className={`group relative block w-full overflow-hidden rounded-xl bg-surface ring-1 transition ${sel ? "ring-2 ring-forest" : "ring-line hover:ring-ink"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" loading="lazy" className="aspect-square w-full bg-white object-contain p-1" />
                      {sel && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-forest text-xs font-bold text-white">{picked.indexOf(f.url) + 1}</span>}
                      <span className="block truncate px-2 py-1.5 text-left text-[0.6875rem] text-muted">{f.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {more && (
            <div className="mt-4 text-center">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => { const n = page + 1; setPage(n); load(tab, q, n); }}>Show more</button>
            </div>
          )}
        </div>
        {multiple && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <span className="text-sm text-muted">{picked.length ? `${picked.length} selected` : "Tick the photos you want"}</span>
            <button type="button" disabled={!picked.length} onClick={() => onPick(picked)} className="btn btn-primary">Add photos</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One image: preview, upload, choose from media, or paste a link. Writes into a hidden input when `name` is set. */
export function ImageField({ value, onChange, name, id }: { value: string; onChange?: (v: string) => void; name?: string; id?: string }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setV(value), [value]);
  const set = (x: string) => {
    setV(x);
    onChange?.(x);
  };
  return (
    <div>
      {name && <input type="hidden" name={name} value={v} />}
      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(true)} className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface ring-1 ring-line hover:ring-ink" aria-label="Choose image">
          {v ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v} alt="" className="h-full w-full bg-white object-contain" />
          ) : (
            <span className="px-1 text-center text-xs text-muted">Choose image</span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={id} type="url" value={v} onChange={(e) => set(e.target.value)} placeholder="https://…" className="input py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost px-3 py-1.5 text-sm">Media library</button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost px-3 py-1.5 text-sm">{busy ? "Uploading…" : "Upload"}</button>
            {v && <button type="button" onClick={() => set("")} className="px-2 text-sm text-muted underline">Remove</button>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              setBusy(true);
              setErr("");
              const r = await uploadImages(e.target.files);
              setBusy(false);
              e.target.value = "";
              if (r.files[0]) set(r.files[0].url);
              if (r.errors.length) setErr(r.errors.join(" "));
            }}
          />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        </div>
      </div>
      {open && (
        <MediaDialog
          onClose={() => setOpen(false)}
          onPick={(urls) => {
            set(urls[0]);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Several images in order; the first is the main photo. Writes a JSON array into a hidden input `name`. */
export function ImageGallery({ name, initial }: { name: string; initial: string[] }) {
  const [list, setList] = useState<string[]>(initial.filter(Boolean));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setList(next);
  };
  const add = (urls: string[]) => setList((l) => [...l, ...urls.filter((u) => !l.includes(u))]);
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(list)} />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((u, i) => (
          <li
            key={u}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            className={`group relative overflow-hidden rounded-xl bg-white ring-1 ${i === 0 ? "ring-2 ring-forest" : "ring-line"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="aspect-square w-full cursor-grab object-contain p-1.5" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-forest px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">Main photo</span>}
            <div className="flex items-center justify-between border-t border-line bg-white px-1.5 py-1 text-xs">
              <div className="flex">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded px-1.5 py-0.5 hover:bg-surface disabled:opacity-30" aria-label="Move left">←</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="rounded px-1.5 py-0.5 hover:bg-surface disabled:opacity-30" aria-label="Move right">→</button>
              </div>
              {i > 0 && <button type="button" onClick={() => move(i, 0)} className="rounded px-1.5 py-0.5 font-medium hover:bg-surface">Main</button>}
              <button type="button" onClick={() => setList(list.filter((x) => x !== u))} className="rounded px-1.5 py-0.5 text-danger hover:bg-danger/10" aria-label="Remove photo">✕</button>
            </div>
          </li>
        ))}
        <li>
          <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-2 text-center">
            <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-forest hover:underline">Media library</button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-sm font-medium text-forest hover:underline">{busy ? "Uploading…" : "Upload"}</button>
          </div>
        </li>
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          setBusy(true);
          setErr("");
          const r = await uploadImages(e.target.files);
          setBusy(false);
          e.target.value = "";
          add(r.files.map((f) => f.url));
          if (r.errors.length) setErr(r.errors.join(" "));
        }}
      />
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
      <p className="mt-2 text-xs text-muted">Drag to reorder. The first photo is shown in lists and on the home page.</p>
      {open && (
        <MediaDialog
          multiple
          initialTab="uploads"
          onClose={() => setOpen(false)}
          onPick={(urls) => {
            add(urls);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
