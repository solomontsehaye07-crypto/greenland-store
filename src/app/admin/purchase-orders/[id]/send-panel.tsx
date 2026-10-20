"use client";

import { useActionState } from "react";
import Link from "next/link";
import { markPoSent, sendPoAction } from "../../actions";

type State = null | { ok?: string; error?: string; link?: string; pdfUrl?: string };

export function SendPanel({ poId, hasEmail, hasWhatsApp, preferred, status, email, whatsapp }: { poId: number; hasEmail: boolean; hasWhatsApp: boolean; preferred: string; status: string; email?: string | null; whatsapp?: string | null }) {
  const [state, action, pending] = useActionState<State, FormData>(sendPoAction, null);
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-[0.9375rem] font-semibold">Send to supplier</h2>
      <p className="mt-0.5 text-xs text-muted">The PDF from the preview is sent and saved in the archive. Supplier prefers {preferred}.{status !== "draft" ? " Sending again shares the latest version." : ""}</p>
      <form action={action} className="mt-4 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="po_id" value={poId} />
        <button name="channel" value="email" disabled={!hasEmail || pending} className="btn btn-primary">
          {pending ? "Sending…" : "Email the PDF"}
        </button>
        <button name="channel" value="whatsapp" disabled={!hasWhatsApp || pending} className="btn btn-ghost">
          Send on WhatsApp
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        {email ? `Email: ${email}` : "No email address yet."} · {whatsapp ? `WhatsApp: ${whatsapp}` : "No WhatsApp number yet."} · <Link href="/admin/suppliers" className="underline">edit supplier</Link>
      </p>
      {state?.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm font-medium text-forest" role="status">{state.ok}</p>}
      {state?.link && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-sm">
          <p>WhatsApp opens with your message and a link to the PDF. Press send there, then confirm here so it is archived.</p>
          <a href={state.link} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Open WhatsApp</a>
          <form action={markPoSent}>
            <input type="hidden" name="po_id" value={poId} />
            <button className="btn btn-ghost w-full">I sent it on WhatsApp</button>
          </form>
        </div>
      )}
    </section>
  );
}
