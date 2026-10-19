"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const linkError = useSearchParams().get("error");
  const [state, action, pending] = useActionState(signIn, null as null | { error?: string; ok?: string });
  return (
    <div className="mx-auto max-w-sm px-4 pt-24">
      <h1 className="text-3xl font-extrabold">Staff sign in</h1>
      <p className="mt-2 text-sm text-muted">Use your password, or leave it empty to get a sign-in link by email.</p>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" />
        </div>
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
        {!state && linkError && <p className="text-sm text-danger">{linkError}</p>}
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green">{state.ok}</p>}
      </form>
    </div>
  );
}
