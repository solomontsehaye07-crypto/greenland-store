"use client";

import { useState } from "react";
import { WhatsAppPdf } from "@/components/whatsapp-pdf";

// Send the PDF FILE to anyone on WhatsApp – e.g. someone who has to approve it. Nothing goes to the supplier.
export function SharePanel({ poId, what }: { poId: number; what: string }) {
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const num = phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "").replace(/^0/, "49");
  return (
    <details className="rounded-2xl border-2 border-line bg-white p-4">
      <summary className="cursor-pointer text-[0.9375rem] font-semibold">Send to another WhatsApp number</summary>
      <p className="mt-1 text-xs text-muted">For example to ask someone to approve {what}. The PDF file is sent, nothing goes to the supplier.</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor={`share-note-${poId}`}>Your note (optional)</label>
          <input id={`share-note-${poId}`} name="share_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Is this okay?" className="input text-base" />
        </div>
        <WhatsAppPdf poId={poId} audience="other" note={note} phone={num.length >= 7 ? num : null} label="Send the PDF on WhatsApp" />
        <p className="text-xs text-muted">Your phone asks where to send it: choose WhatsApp, then the person.</p>
        <div className="rounded-xl bg-surface p-3">
          <label className="label" htmlFor={`share-to-${poId}`}>Person not in your WhatsApp yet? Type the number</label>
          <div className="flex gap-2">
            <input id={`share-to-${poId}`} name="share_to" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 170 1234567" className="input min-w-0 flex-1 text-base" />
            <a
              href={num.length >= 7 ? `https://wa.me/${num}${note.trim() ? `?text=${encodeURIComponent(note.trim())}` : ""}` : undefined}
              aria-disabled={num.length < 7}
              className={`btn btn-ghost shrink-0 px-4 ${num.length < 7 ? "pointer-events-none opacity-50" : ""}`}
            >
              Open chat
            </a>
          </div>
          <p className="mt-1 text-xs text-muted">This opens a chat with that number. Come back and tap “Send the PDF on WhatsApp” – the chat is now at the top of the list.</p>
        </div>
      </div>
    </details>
  );
}
