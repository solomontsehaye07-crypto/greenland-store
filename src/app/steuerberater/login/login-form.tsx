"use client";

import { useActionState } from "react";
import { sendPortalCode, verifyPortalCode, type PortalLogin } from "./actions";

export function LoginForm() {
  const [sent, send, sending] = useActionState<PortalLogin, FormData>(sendPortalCode, null);
  const [checked, verify, verifying] = useActionState<PortalLogin, FormData>(verifyPortalCode, null);
  const state = checked ?? sent;
  const step = state?.step === "code";
  const email = state?.email ?? "";
  const field = "w-full border border-[#a9a9a9] px-2.5 py-2 text-sm outline-none focus:border-[#b4232a] focus:ring-1 focus:ring-[#b4232a]";
  const btn = "w-full border border-[#8f1a20] bg-[#b4232a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9b1d23] disabled:opacity-60";
  return (
    <div className="space-y-3">
      {state?.ok && !checked?.error && <p role="status" className="border border-[#bcd7bc] bg-[#eef7ee] px-3 py-2 text-sm text-[#285c28]">{state.ok}</p>}
      {state?.error && <p role="alert" className="border border-[#e2b4b4] bg-[#fbeaea] px-3 py-2 text-sm text-[#8a1f1f]">{state.error}</p>}
      {!step ? (
        <form action={send} className="space-y-3">
          <div>
            <label htmlFor="stb-email" className="mb-1 block text-xs font-semibold text-[#444]">E-Mail-Adresse</label>
            <input id="stb-email" name="email" type="email" autoComplete="email" required className={field} />
          </div>
          <button disabled={sending} className={btn}>{sending ? "Wird gesendet …" : "Anmeldecode senden"}</button>
        </form>
      ) : (
        <form action={verify} className="space-y-3">
          <input type="hidden" name="email" value={email} />
          <div>
            <label htmlFor="stb-code" className="mb-1 block text-xs font-semibold text-[#444]">Code aus der E-Mail</label>
            <input id="stb-code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={`${field} tracking-[0.3em]`} />
          </div>
          <button disabled={verifying} className={btn}>{verifying ? "Wird geprüft …" : "Anmelden"}</button>
        </form>
      )}
    </div>
  );
}
