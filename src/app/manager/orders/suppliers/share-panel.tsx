"use client";

import { useActionState, useEffect } from "react";
import { shareAction } from "../../actions";

// Send the list (or the offer) to any WhatsApp number – e.g. to someone who has to approve it.
// Numbers typed here are suggested again next time (field memory).
export function SharePanel({ poId, what }: { poId: number; what: string }) {
  const [state, action, pending] = useActionState(shareAction, null);
  useEffect(() => {
    if (state?.link) window.location.href = state.link;
  }, [state]);
  return (
    <details className="rounded-2xl border-2 border-line bg-white p-4">
      <summary className="cursor-pointer text-[0.9375rem] font-semibold">Send to another WhatsApp number</summary>
      <p className="mt-1 text-xs text-muted">For example to ask someone to approve {what}. This does not send anything to the supplier.</p>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="po_id" value={poId} />
        <div>
          <label className="label" htmlFor={`share-to-${poId}`}>WhatsApp number</label>
          <input id={`share-to-${poId}`} name="share_to" type="tel" inputMode="tel" autoComplete="tel" placeholder="+49 170 1234567" className="input text-base" required />
        </div>
        <div>
          <label className="label" htmlFor={`share-note-${poId}`}>Your note (optional)</label>
          <input id={`share-note-${poId}`} name="share_note" placeholder="e.g. Is this okay?" className="input text-base" />
        </div>
        {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Preparing…" : "Open WhatsApp"}</button>
        {state?.link && <a href={state.link} className="block text-center text-sm font-semibold text-forest underline">WhatsApp did not open? Tap here</a>}
      </form>
    </details>
  );
}
