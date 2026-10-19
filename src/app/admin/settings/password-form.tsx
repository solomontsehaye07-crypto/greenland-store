"use client";

import { useActionState } from "react";
import { setOwnPassword } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setOwnPassword, null as null | { error?: string; ok?: string });
  return (
    <form action={action} className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-xl font-bold">Your password</h2>
        <p className="mt-1 text-sm text-muted">Set a password so you can sign in without waiting for an email link.</p>
      </div>
      <div><label className="label" htmlFor="pw">New password</label><input id="pw" name="password" type="password" autoComplete="new-password" className="input" required minLength={10} /></div>
      <div><label className="label" htmlFor="pw2">Repeat password</label><input id="pw2" name="confirm" type="password" autoComplete="new-password" className="input" required minLength={10} /></div>
      <button disabled={pending} className="btn btn-primary sm:col-span-2">{pending ? "Saving…" : "Save password"}</button>
      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green sm:col-span-2">{state.ok}</p>}
    </form>
  );
}
