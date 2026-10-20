"use client";

import { useActionState } from "react";
import { createPage } from "../actions";

export function NewPageForm() {
  const [state, action, pending] = useActionState(createPage, null);
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
      <div className="sm:col-span-3">
        <h2 className="text-[0.9375rem] font-semibold">New page</h2>
        <p className="mt-1 text-sm text-muted">It starts as a draft. You add the text and publish it on the next screen.</p>
      </div>
      <div>
        <label htmlFor="np-title" className="label">Title (Deutsch)</label>
        <input id="np-title" name="title" className="input" placeholder="Rezepte" />
      </div>
      <div>
        <label htmlFor="np-slug" className="label">Address</label>
        <input id="np-slug" name="slug" required pattern="[a-z0-9-]+" className="input" placeholder="rezepte" />
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create page"}</button>
      {state?.error && <p className="text-sm text-danger sm:col-span-3" role="alert">{state.error}</p>}
    </form>
  );
}
