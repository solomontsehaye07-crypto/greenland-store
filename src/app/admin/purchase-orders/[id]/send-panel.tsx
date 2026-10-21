"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { markPoSent, sendPoAction } from "../../actions";

type State = null | { ok?: string; error?: string; link?: string; pdfUrl?: string };

export function SendPanel({ poId, hasEmail, hasWhatsApp, preferred, status, email, whatsapp, quote = false, next }: { poId: number; hasEmail: boolean; hasWhatsApp: boolean; preferred: string; status: string; email?: string | null; whatsapp?: string | null; quote?: boolean; next?: string }) {
  const [state, action, pending] = useActionState<State, FormData>(sendPoAction, null);
  useEffect(() => {
    if (next && state?.ok) window.location.href = `${next}${next.includes("?") ? "&" : "?"}msg=${encodeURIComponent(state.ok)}`;
  }, [state, next]);
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-[0.9375rem] font-semibold">{quote ? "Ask the supplier for prices" : "Send the order to the supplier"}</h2>
      <p className="mt-0.5 text-xs text-muted">
        {quote
          ? "Nothing is ordered yet. The supplier gets the list and a link to type in their prices. You decide after."
          : "The PDF from the preview is sent and saved in the archive."}{" "}
        Supplier prefers {preferred}.{status !== "draft" && status !== "quoted" ? " Sending again shares the latest version." : ""}
      </p>
      <form action={action} className="mt-4 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="po_id" value={poId} />
        <button name="channel" value="email" disabled={!hasEmail || pending} className="btn btn-primary">
          {pending ? "Sending…" : quote ? "Ask by email" : "Email the order"}
        </button>
        <button name="channel" value="whatsapp" disabled={!hasWhatsApp || pending} className="btn btn-ghost">
          {quote ? "Ask on WhatsApp" : "Send order on WhatsApp"}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        {email ? `Email: ${email}` : "No email address yet."} · {whatsapp ? `WhatsApp: ${whatsapp}` : "No WhatsApp number yet."} · <Link href="/admin/suppliers" className="underline">edit supplier</Link>
      </p>
      {state?.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm font-medium text-forest" role="status">{state.ok}</p>}
      {state?.link && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-sm">
          <p>WhatsApp opens with your message{quote ? ", the link for prices" : ""} and the PDF link. Press send there, then confirm here so it is archived.</p>
          <a href={state.link} className="btn btn-primary w-full">Open WhatsApp</a>
          <form action={markPoSent}>
            <input type="hidden" name="po_id" value={poId} />
            {next && <input type="hidden" name="next" value={next} />}
            <button className="btn btn-ghost w-full">I sent it on WhatsApp</button>
          </form>
        </div>
      )}
    </section>
  );
}
