"use client";

import { useActionState, useEffect, useState } from "react";
import { WhatsAppPdf } from "@/components/whatsapp-pdf";
import Link from "next/link";
import { markPoSent, sendPoAction } from "../../actions";

type State = null | { ok?: string; error?: string; link?: string; pdfUrl?: string };

export function SendPanel({ poId, hasEmail, hasWhatsApp, preferred, status, email, whatsapp, quote = false, next }: { poId: number; hasEmail: boolean; hasWhatsApp: boolean; preferred: string; status: string; email?: string | null; whatsapp?: string | null; quote?: boolean; next?: string }) {
  const [state, action, pending] = useActionState<State, FormData>(sendPoAction, null);
  const [shared, setShared] = useState(false);
  useEffect(() => {
    if (next && state?.ok) window.location.href = `${next}${next.includes("?") ? "&" : "?"}msg=${encodeURIComponent(state.ok)}`;
  }, [state, next]);
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-[0.9375rem] font-semibold">{quote ? "Ask the supplier for prices" : "Send the order to the supplier"}</h2>
      <p className="mt-0.5 text-xs text-muted">
        {quote
          ? "Nothing is ordered yet. The supplier gets the PDF and replies with prices (or types them on a link in the message). You decide after."
          : "The PDF from the preview is sent and saved in the archive."}{" "}
        Supplier prefers {preferred}.{status !== "draft" && status !== "quoted" ? " Sending again shares the latest version." : ""}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <form action={action}>
          <input type="hidden" name="po_id" value={poId} />
          <button name="channel" value="email" disabled={!hasEmail || pending} className="btn btn-primary w-full">
            {pending ? "Sending…" : quote ? "Ask by email" : "Email the order"}
          </button>
        </form>
        {hasWhatsApp ? (
          <WhatsAppPdf poId={poId} audience="supplier" phone={whatsapp} label={quote ? "Ask on WhatsApp" : "Send order on WhatsApp"} className="btn btn-ghost w-full" onShared={() => setShared(true)} />
        ) : (
          <button disabled className="btn btn-ghost w-full">No WhatsApp number</button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">The PDF file itself is attached to the email and to the WhatsApp message.</p>
      <p className="mt-2 text-xs text-muted">
        {email ? `Email: ${email}` : "No email address yet."} · {whatsapp ? `WhatsApp: ${whatsapp}` : "No WhatsApp number yet."} · <Link href="/admin/suppliers" className="underline">edit supplier</Link>
      </p>
      {state?.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm font-medium text-forest" role="status">{state.ok}</p>}
      {shared && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-sm">
          <p>Did you send it in WhatsApp? Confirm so it is marked as sent and the PDF is kept in the archive.</p>
          <form action={markPoSent}>
            <input type="hidden" name="po_id" value={poId} />
            {next && <input type="hidden" name="next" value={next} />}
            <button className="btn btn-primary w-full">Yes, I sent it</button>
          </form>
        </div>
      )}
    </section>
  );
}
