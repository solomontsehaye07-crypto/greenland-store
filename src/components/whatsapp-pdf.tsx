"use client";

import { useEffect, useState } from "react";
import { logShareAction, poShareTextAction } from "@/app/admin/actions";

type Nav = Navigator & { canShare?: (d: ShareData) => boolean };

// Sends the finished PDF FILE (not a link) to WhatsApp through the phone's share sheet: tap, choose
// WhatsApp, choose the chat. The file and message are prepared in advance, because phones only allow the
// share sheet straight after a tap. On a computer the PDF is downloaded and WhatsApp opens to attach it.
export function WhatsAppPdf({
  poId,
  audience,
  phone,
  note = "",
  label,
  className = "btn btn-primary w-full",
  onShared,
}: {
  poId: number;
  audience: "supplier" | "other";
  phone?: string | null;
  note?: string;
  label: string;
  className?: string;
  onShared?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [res, t] = await Promise.all([fetch(`/admin/purchase-orders/${poId}/pdf`, { cache: "no-store" }), poShareTextAction(poId, audience)]);
        if (!res.ok) throw new Error();
        const buf = await res.arrayBuffer();
        if (off) return;
        setFile(new File([buf], t.filename, { type: "application/pdf" }));
        setText(t.message);
      } catch {
        if (!off) setErr("The PDF could not be prepared. Reload the page and try again.");
      }
    })();
    return () => {
      off = true;
    };
  }, [poId, audience]);

  const message = note.trim() ? `${note.trim()}\n\n${text}` : text;

  const send = async () => {
    if (!file) return;
    setErr("");
    const nav = navigator as Nav;
    if (nav.share && nav.canShare?.({ files: [file] })) {
      // some WhatsApp versions drop the text when a file is shared – keep it on the clipboard to paste
      nav.clipboard?.writeText(message).catch(() => null);
      try {
        await nav.share({ files: [file], text: message, title: file.name });
        setHint("If the message text is missing in WhatsApp, paste it – it is copied.");
        if (audience === "other") logShareAction(poId).catch(() => null);
        onShared?.();
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErr("Sharing did not work on this device.");
      }
      return;
    }
    // computer: download the file, then open WhatsApp with the message to attach it
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    const num = (phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "").replace(/^0/, "49");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    setHint(`The PDF was downloaded (${file.name}). Attach it in the WhatsApp chat with the 📎 button.`);
    if (audience === "other") logShareAction(poId).catch(() => null);
    onShared?.();
  };

  return (
    <div>
      <button type="button" onClick={send} disabled={!file} className={className}>
        {file ? label : "Preparing the PDF…"}
      </button>
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
      {hint && <p className="mt-2 text-xs text-muted" role="status">{hint}</p>}
    </div>
  );
}
