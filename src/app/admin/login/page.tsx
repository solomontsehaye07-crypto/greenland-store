"use client";

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { passwordSignIn, sendCode, verifyCode, type LoginState } from "./actions";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const linkError = params.get("error");
  const denied = params.get("denied");
  const next = params.get("next") ?? "/admin";
  const [mode, setMode] = useState<"code" | "password">("code");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(sendCode, null);
  const [checked, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, null);
  const [pw, pwAction, pwPending] = useActionState<LoginState, FormData>(passwordSignIn, null);
  const [again, setAgain] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const step = !again && (sent?.step === "code" || checked?.step === "code") ? (checked?.step === "code" ? checked : sent) : null;

  useEffect(() => {
    if (step) codeRef.current?.focus();
  }, [step]);

  return (
    <div className="mx-auto max-w-sm px-4 pt-20 sm:pt-28">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/greenland-mark.svg?v=3" alt="" className="h-9 w-auto" />
      <h1 className="display mt-5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Staff sign in</h1>
      {denied && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">This account has no access to the admin.</p>}
      {linkError && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{linkError}</p>}

      {mode === "code" && !step && (
        <>
          <p className="mt-2 text-sm text-muted">We send you a one-time code. No password needed.</p>
          <div className="mt-6 flex rounded-full bg-surface p-1 text-sm" role="tablist" aria-label="Send the code by">
            {(["email", "sms"] as const).map((c) => (
              <button key={c} type="button" role="tab" aria-selected={channel === c} onClick={() => setChannel(c)} className={`flex-1 rounded-full px-3 py-2 font-medium ${channel === c ? "bg-[var(--card)] shadow-sm" : "text-muted"}`}>
                {c === "email" ? "Email" : "SMS"}
              </button>
            ))}
          </div>
          <form action={(fd) => { setAgain(false); sendAction(fd); }} className="mt-4 space-y-4">
            <input type="hidden" name="channel" value={channel} />
            <div>
              <label className="label" htmlFor="target">{channel === "email" ? "Email" : "Mobile number"}</label>
              <input
                key={channel}
                id="target"
                name="target"
                type={channel === "email" ? "email" : "tel"}
                required
                autoComplete={channel === "email" ? "email" : "tel"}
                inputMode={channel === "email" ? "email" : "tel"}
                placeholder={channel === "email" ? "name@example.com" : "0152 1234567"}
                defaultValue={sent?.channel === channel ? sent?.target ?? "" : ""}
                className="input"
              />
            </div>
            <button disabled={sending} className="btn btn-primary w-full">{sending ? "Sending…" : "Send code"}</button>
            {sent?.error && <p className="text-sm text-danger" role="alert">{sent.error}</p>}
          </form>
        </>
      )}

      {mode === "code" && step && (
        <form action={verifyAction} className="mt-6 space-y-4">
          <p className="text-sm text-forest" role="status">{sent?.ok}</p>
          <input type="hidden" name="channel" value={step.channel} />
          <input type="hidden" name="target" value={step.target} />
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="code">Code</label>
            <input
              ref={codeRef}
              id="code"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,10}"
              maxLength={10}
              placeholder="123456"
              className="input text-center font-mono text-2xl tracking-[0.4em]"
            />
          </div>
          <button disabled={verifying} className="btn btn-primary w-full">{verifying ? "Checking…" : "Sign in"}</button>
          {checked?.error && <p className="text-sm text-danger" role="alert">{checked.error}</p>}
          <button type="button" onClick={() => setAgain(true)} className="w-full text-sm text-muted underline">Send a new code / change {step.channel === "email" ? "email" : "number"}</button>
          {step.channel === "email" && <p className="text-xs text-muted">No code in the email, only a link? Clicking the link signs you in too.</p>}
        </form>
      )}

      {mode === "password" && (
        <form action={pwAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
          <button disabled={pwPending} className="btn btn-primary w-full">{pwPending ? "Signing in…" : "Sign in"}</button>
          {pw?.error && <p className="text-sm text-danger" role="alert">{pw.error}</p>}
        </form>
      )}

      <button type="button" onClick={() => setMode(mode === "code" ? "password" : "code")} className="mt-6 text-sm font-medium text-forest underline">
        {mode === "code" ? "Sign in with a password instead" : "Sign in with a one-time code"}
      </button>
    </div>
  );
}
