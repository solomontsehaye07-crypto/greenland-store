"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { Field } from "@/lib/sections";
import type { FormState } from "@/app/admin/website/actions";

type Obj = Record<string, unknown>;
type L = { de?: string; en?: string };
export type CategoryOption = { slug: string; label: string; group?: string };

const LOCALISED = new Set(["text", "textarea", "markdown"]);

function asL10n(v: unknown): L {
  if (typeof v === "string") return { de: v, en: "" };
  if (v && typeof v === "object") return v as L;
  return { de: "", en: "" };
}

function emptyItem(fields: Field[]): Obj {
  const o: Obj = {};
  for (const f of fields) {
    if (LOCALISED.has(f.kind)) o[f.key] = { de: "", en: "" };
    else if (f.kind === "list") o[f.key] = [];
    else if (f.kind === "toggle") o[f.key] = false;
    else if (f.kind === "select" && f.options?.length) o[f.key] = f.options[0].value;
    else o[f.key] = "";
  }
  return o;
}

// ---------- media: upload + picker ----------

type MediaFile = { name: string; url: string };

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

function MediaPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/admin/website/upload")
      .then((r) => r.json())
      .then((j) => (j.files ? setFiles(j.files) : setErr(j.error ?? "Could not load the media library.")))
      .catch(() => setErr("Could not load the media library."));
  }, []);
  return (
    <div className="mt-2 rounded-xl border border-line bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Media library</span>
        <button type="button" onClick={onClose} className="text-sm text-muted underline">Close</button>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      {!files && !err && <p className="text-sm text-muted">Loading…</p>}
      {files && !files.length && <p className="text-sm text-muted">No uploads yet. Use Upload to add the first image.</p>}
      {files && files.length > 0 && (
        <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {files.map((f) => (
            <li key={f.name}>
              <button type="button" onClick={() => onPick(f.url)} className="block w-full overflow-hidden rounded-lg bg-white ring-1 ring-line hover:ring-2 hover:ring-forest" title={f.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picking, setPicking] = useState(false);
  return (
    <div>
      <div className="flex gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-xs text-muted">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={id} type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="input py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost px-3 py-1.5 text-sm">
              {busy ? "Uploading…" : "Upload"}
            </button>
            <button type="button" onClick={() => setPicking((p) => !p)} className="btn btn-ghost px-3 py-1.5 text-sm">Choose from media</button>
            {value && <button type="button" onClick={() => onChange("")} className="px-2 text-sm text-muted underline">Remove</button>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files;
              if (!f?.length) return;
              setBusy(true);
              setErr("");
              const r = await uploadImages(f);
              setBusy(false);
              e.target.value = "";
              if (r.files[0]) onChange(r.files[0].url);
              if (r.errors.length) setErr(r.errors.join(" "));
            }}
          />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        </div>
      </div>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(url) => {
            onChange(url);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- one field ----------

function FieldInput({ field, value, onChange, categories }: { field: Field; value: unknown; onChange: (v: unknown) => void; categories: CategoryOption[] }) {
  const id = useId();
  const k = field.kind;

  if (LOCALISED.has(k)) {
    const v = asL10n(value);
    const set = (lang: "de" | "en", s: string) => onChange({ ...v, [lang]: s });
    const rows = k === "markdown" ? 8 : 3;
    return (
      <fieldset>
        <legend className="label">{field.label}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(["de", "en"] as const).map((lang) => (
            <div key={lang}>
              <label htmlFor={`${id}-${lang}`} className="mb-1 block text-xs font-medium text-muted">{lang === "de" ? "Deutsch" : "English"}</label>
              {k === "text" ? (
                <input id={`${id}-${lang}`} value={v[lang] ?? ""} onChange={(e) => set(lang, e.target.value)} className="input" />
              ) : (
                <textarea id={`${id}-${lang}`} rows={rows} value={v[lang] ?? ""} onChange={(e) => set(lang, e.target.value)} className="input leading-relaxed" />
              )}
            </div>
          ))}
        </div>
        {k === "markdown" && <p className="mt-1 text-xs text-muted">Formatting: ## heading, **bold**, *italic*, - list item, [link text](/c/food). Leave an empty line between paragraphs.</p>}
        {field.help && <p className="mt-1 text-xs text-muted">{field.help}</p>}
      </fieldset>
    );
  }

  if (k === "list") {
    const items = (Array.isArray(value) ? value : []) as Obj[];
    const sub = field.item ?? [];
    const max = field.max ?? 50;
    const setItems = (next: Obj[]) => onChange(next);
    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      setItems(next);
    };
    return (
      <fieldset>
        <legend className="label">
          {field.label} <span className="font-normal text-muted">({items.length}{field.max ? ` of max ${field.max}` : ""})</span>
        </legend>
        {field.help && <p className="mb-2 text-xs text-muted">{field.help}</p>}
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-line bg-paper/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{field.itemLabel ?? "Item"} {i + 1}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full px-2.5 py-1 text-sm hover:bg-surface disabled:opacity-30" aria-label={`Move ${field.itemLabel ?? "item"} ${i + 1} up`}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-full px-2.5 py-1 text-sm hover:bg-surface disabled:opacity-30" aria-label={`Move ${field.itemLabel ?? "item"} ${i + 1} down`}>↓</button>
                  <button type="button" onClick={() => setItems(items.filter((_, x) => x !== i))} className="rounded-full px-2.5 py-1 text-sm text-danger hover:bg-danger/10">Remove</button>
                </div>
              </div>
              <div className="space-y-4">
                {sub.map((f) => (
                  <FieldInput key={f.key} field={f} value={it?.[f.key]} categories={categories} onChange={(v) => setItems(items.map((x, xi) => (xi === i ? { ...x, [f.key]: v } : x)))} />
                ))}
              </div>
            </li>
          ))}
        </ol>
        {items.length < max && (
          <button type="button" onClick={() => setItems([...items, emptyItem(sub)])} className="btn btn-ghost mt-3 py-2 text-sm">
            Add {(field.itemLabel ?? "item").toLowerCase()}
          </button>
        )}
      </fieldset>
    );
  }

  if (k === "toggle") {
    return (
      <div>
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--forest)]" />
          <span className="text-sm font-semibold">{field.label}</span>
        </label>
        {field.help && <p className="mt-1 text-xs text-muted">{field.help}</p>}
      </div>
    );
  }

  let control: React.ReactNode;
  if (k === "image") control = <ImageInput id={id} value={typeof value === "string" ? value : ""} onChange={onChange} />;
  else if (k === "number")
    control = (
      <input id={id} type="number" value={value === undefined || value === null || value === "" ? "" : Number(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className="input max-w-[10rem]" />
    );
  else if (k === "color") {
    const hex = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
    control = (
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={hex} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" />
        <input aria-label={`${field.label} hex value`} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="input max-w-[8rem] font-mono text-sm" maxLength={7} />
      </div>
    );
  } else if (k === "select")
    control = (
      <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="input max-w-sm">
        {!field.options?.some((o) => o.value === value) && <option value="">Choose…</option>}
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  else if (k === "category") {
    const groups = Array.from(new Set(categories.map((c) => c.group ?? "")));
    control = (
      <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="input max-w-sm">
        <option value="">Choose a category…</option>
        {groups.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {categories.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </optgroup>
          ) : (
            categories.filter((c) => !c.group).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)
          )
        )}
      </select>
    );
  } else control = <input id={id} value={typeof value === "string" ? value : value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className="input" />;

  return (
    <div>
      <label htmlFor={id} className="label">{field.label}</label>
      {control}
      {field.help && <p className="mt-1 text-xs text-muted">{field.help}</p>}
    </div>
  );
}

// ---------- the form ----------

export function FieldEditor({
  fields,
  initial,
  action,
  categories = [],
  onChange,
  resetTo,
  submitLabel = "Save changes",
  viewHref = "/",
}: {
  fields: Field[];
  initial: Obj;
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  categories?: CategoryOption[];
  onChange?: (data: Obj) => void;
  resetTo?: Obj;
  submitLabel?: string;
  viewHref?: string;
}) {
  const [data, setData] = useState<Obj>(initial ?? {});
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next: Obj) => {
    setData(next);
    setDirty(true);
    onChange?.(next);
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <div className="space-y-6 rounded-2xl bg-white p-5 sm:p-6">
        {fields.map((f) => (
          <FieldInput key={f.key} field={f} value={data[f.key]} categories={categories} onChange={(v) => update({ ...data, [f.key]: v })} />
        ))}
      </div>
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 backdrop-blur">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : submitLabel}</button>
        {resetTo && (
          <button type="button" onClick={() => update({ ...resetTo })} className="btn btn-ghost">Reset to defaults</button>
        )}
        <Link href={viewHref} target="_blank" className="text-sm font-semibold underline underline-offset-2">View on site</Link>
        <span className="text-sm" role="status" aria-live="polite">
          {state?.error ? <span className="text-danger">{state.error}</span> : dirty ? <span className="text-muted">Unsaved changes</span> : state?.ok ? <span className="font-semibold text-forest">{state.ok}</span> : null}
        </span>
      </div>
    </form>
  );
}
