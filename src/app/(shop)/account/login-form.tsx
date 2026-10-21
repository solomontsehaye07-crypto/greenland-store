"use client";

import { useActionState } from "react";
import { confirmCode, requestCode, type AccountState } from "./actions";

const T = {
  de: { title: "Anmelden oder Konto anlegen", sub: "Gib deine E-Mail ein – wir schicken dir einen 6-stelligen Code. Kein Passwort nötig.", email: "E-Mail-Adresse", send: "Code schicken", code: "Code aus der E-Mail", go: "Anmelden", again: "Anderen Code anfordern", perks: ["Bestellungen und Lieferstatus im Blick", "Adresse gespeichert – schneller bestellen", "Mit einem Klick nachbestellen", "10 % Willkommensrabatt auf die erste Bestellung"] },
  en: { title: "Sign in or create an account", sub: "Enter your email – we send you a 6-digit code. No password needed.", email: "Email address", send: "Send code", code: "Code from the email", go: "Sign in", again: "Request another code", perks: ["See your orders and delivery status", "Saved address – faster checkout", "Reorder with one tap", "10 % welcome discount on your first order"] },
};

export function LoginForm({ lang, next }: { lang: "de" | "en"; next?: string }) {
  const t = T[lang];
  const [s1, send, p1] = useActionState<AccountState, FormData>(requestCode, null);
  const [s2, verify, p2] = useActionState<AccountState, FormData>(confirmCode, null);
  const state = s2?.step || s2?.error ? s2 : s1;
  const email = state?.email ?? "";
  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl bg-white p-6 sm:p-8">
        <h1 className="display text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.sub}</p>
        {state?.step !== "code" ? (
          <form action={send} className="mt-6 space-y-3">
            <label className="label" htmlFor="acc-email">{t.email}</label>
            <input id="acc-email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={email} className="input text-base" />
            {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
            <button disabled={p1} className="btn btn-primary min-h-12 w-full text-base font-bold">{p1 ? "…" : t.send}</button>
          </form>
        ) : (
          <form action={verify} className="mt-6 space-y-3">
            <input type="hidden" name="email" value={email} />
            {next && <input type="hidden" name="next" value={next} />}
            <p className="text-sm text-forest" role="status">{s1?.ok}</p>
            <label className="label" htmlFor="acc-code">{t.code}</label>
            <input id="acc-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} required autoFocus className="input text-center text-2xl font-bold tracking-[0.4em]" />
            {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
            <button disabled={p2} className="btn btn-primary min-h-12 w-full text-base font-bold">{p2 ? "…" : t.go}</button>
            <button formAction={send} formNoValidate className="w-full py-2 text-sm text-muted underline">{t.again}</button>
          </form>
        )}
      </div>
      <ul className="space-y-3 self-center text-[0.9375rem]">
        {t.perks.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">✓</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
