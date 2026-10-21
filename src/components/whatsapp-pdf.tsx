"use client";

import { useEffect, useState } from "react";
import { archiveSharedPdfAction } from "@/app/admin/actions";
import { toBase64 } from "@/lib/po-pdf-client";
import { loadDoc, type DocSource } from "@/lib/doc-client";

type Nav = Navigator & { canShare?: (d: ShareData) => boolean };

// Sends the finished PDF FILE (not a link) to WhatsApp through the phone's share sheet: tap, choose
// WhatsApp, choose the chat. The file and message are prepared in advance, because phones only allow the
// share sheet straight after a tap. On a computer the PDF is downloaded and WhatsApp opens to attach it.
export function WhatsAppPdf({
  poId,
  audience = "supplier",
  source,
  phone,
  note = "",
  label,
  className = "btn btn-primary w-full",
  onShared,
}: {
  poId?: number;
  audience?: "supplier" | "other";
  source?: DocSource; // any document; default: the supplier request poId
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

  const src: DocSource = source ?? { type: "po", id: poId!, audience };
  const key = JSON.stringify(src);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [try_, setTry] = useState(0);

  useEffect(() => {
    let off = false;
    setErr("");
    (async () => {
      try {
        const r = await loadDoc(src);
        if (off) return;
        setBytes(r.bytes);
        setFile(new File([r.bytes as BlobPart], r.filename, { type: "application/pdf" }));
        setText(r.message);
      } catch (e) {
        if (!off) setErr(`The PDF could not be prepared: ${(e as Error).message}`);
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, try_]);

  const archive = () => {
    if (bytes && src.type === "po") archiveSharedPdfAction(src.id, toBase64(bytes), audience).catch(() => null);
  };

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
        archive();
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
    archive();
    onShared?.();
  };

  return (
    <div>
      <button type="button" onClick={send} disabled={!file} className={className}>
        {file ? label : err ? label : "Preparing the PDF…"}
      </button>
      {err && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {err}{" "}
          <button type="button" onClick={() => setTry((n) => n + 1)} className="font-semibold underline">Try again</button>
        </p>
      )}
      {hint && <p className="mt-2 text-xs text-muted" role="status">{hint}</p>}
    </div>
  );
}
