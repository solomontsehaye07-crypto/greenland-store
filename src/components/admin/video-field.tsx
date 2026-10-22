"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Video for a website section: paste a YouTube / Instagram link, or upload an MP4 (max 50 MB).
 * Uploads go straight from the browser to storage with a one-time signed address.
 */
export function VideoField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  async function upload(file: File) {
    setMsg(null);
    if (file.size > 50 * 1024 * 1024) {
      setMsg({ error: "The video is larger than 50 MB. Shorten it or export it smaller (1080p, H.264 MP4) and try again." });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/admin/website/upload/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const j = (await r.json()) as { bucket?: string; path?: string; token?: string; url?: string; error?: string };
      if (!r.ok || !j.path || !j.token || !j.bucket || !j.url) throw new Error(j.error || "Upload could not be prepared.");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { error } = await sb.storage.from(j.bucket).uploadToSignedUrl(j.path, j.token, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      onChange(j.url);
      setMsg({ ok: "Video uploaded. Save the section to publish it." });
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="https://www.youtube.com/watch?v=… or upload a file"
          className="input min-w-0 flex-1"
        />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-ghost">
          {busy ? "Uploading…" : "Upload video"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn btn-ghost">Remove</button>
        )}
        <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {isFile && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={value} muted playsInline controls preload="metadata" className="max-h-56 rounded-xl bg-black" />
      )}
      {msg?.error && <p className="text-xs text-danger" role="alert">{msg.error}</p>}
      {msg?.ok && <p className="text-xs font-semibold text-forest" role="status">{msg.ok}</p>}
    </div>
  );
}
