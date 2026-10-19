"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia } from "../actions";
import { uploadImages } from "@/components/admin/website/field-editor";
import { ConfirmButton } from "@/components/admin/website/confirm-button";

type F = { name: string; url: string; size: number };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function MediaLibrary({ files }: { files: F[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [copied, setCopied] = useState("");

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setMsg({});
    const r = await uploadImages(list);
    setBusy(false);
    setMsg({ ok: r.files.length ? `${r.files.length} ${r.files.length === 1 ? "image" : "images"} uploaded.` : undefined, error: r.errors.join(" ") || undefined });
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-muted">Drag images here, or</p>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-primary mt-3">{busy ? "Uploading…" : "Upload images"}</button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <p className="mt-3 text-sm" role="status" aria-live="polite">
          {msg.ok && <span className="font-semibold text-forest">{msg.ok} </span>}
          {msg.error && <span className="text-danger">{msg.error}</span>}
        </p>
      </div>
      {files.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-muted">No images yet. Upload one above; it will then be available in every image field.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((f) => (
            <li key={f.name} className="overflow-hidden rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.name} loading="lazy" className="aspect-square w-full bg-surface object-cover" />
              <div className="space-y-2 p-3">
                <p className="truncate text-xs text-muted" title={f.name}>{f.name.replace(/^\d+-[a-z0-9]{4}-/, "")} · {kb(f.size)}</p>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(f.url);
                        setCopied(f.name);
                        setTimeout(() => setCopied(""), 2000);
                      } catch {
                        setCopied("");
                      }
                    }}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-surface"
                  >
                    {copied === f.name ? "Copied" : "Copy link"}
                  </button>
                  <form action={deleteMedia}>
                    <input type="hidden" name="name" value={f.name} />
                    <ConfirmButton label="Delete" confirmLabel="Sure?" />
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
