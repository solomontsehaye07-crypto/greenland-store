"use client";

import { useActionState } from "react";
import { markPoSent, sendPoAction } from "../../actions";

type State = null | { ok?: string; error?: string; link?: string; pdfUrl?: string };

export function SendPanel({ poId, hasEmail, hasWhatsApp, preferred, status }: { poId: number; hasEmail: boolean; hasWhatsApp: boolean; preferred: string; status: string }) {
  const [state, action, pending] = useActionState<State, FormData>(sendPoAction, null);
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="text-lg font-bold">Send to supplier</h2>
      <p className="mt-1 text-sm text-muted">The order is sent as a PDF. Preferred: {preferred}.{status !== "draft" ? " Already sent – sending again shares the latest version." : ""}</p>
      <form action={action} className="mt-4 grid gap-2">
        <input type="hidden" name="po_id" value={poId} />
        <button name="channel" value="email" disabled={!hasEmail || pending} className="btn btn-primary">
          {pending ? "Sending…" : "Email PDF to supplier"}
        </button>
        <button name="channel" value="whatsapp" disabled={!hasWhatsApp || pending} className="btn btn-ghost">
          Send on WhatsApp
        </button>
      </form>
      {!hasEmail && <p className="mt-2 text-xs text-muted">Add an email address to the supplier to send by email.</p>}
      {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm text-green">{state.ok}</p>}
      {state?.link && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface p-3 text-sm">
          <p>WhatsApp opens with the message and PDF link filled in. Press send there, then mark it as sent.</p>
          <a href={state.link} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Open WhatsApp</a>
          <form action={markPoSent}>
            <input type="hidden" name="po_id" value={poId} />
            <button className="btn btn-ghost w-full">Mark as sent</button>
          </form>
        </div>
      )}
      {state?.pdfUrl && (
        <a href={state.pdfUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-green underline">Open the PDF that was shared</a>
      )}
    </section>
  );
}
