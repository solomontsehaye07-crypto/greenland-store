"use client";

import { useActionState, useEffect, useState } from "react";
import { joinWithEmail, type AccountState } from "@/app/(shop)/account/actions";

// Welcome offer: 10 % on the first order for an email. Shows once per visitor (after a short while or
// when the mouse leaves the page), never for signed-in customers, never on checkout.
const KEY = "greenland.welcome.v1";

const T = {
  de: { kicker: "Willkommensgeschenk", title: "10 % auf deine erste Bestellung", sub: "Trag deine E-Mail ein und du bekommst sofort deinen Code – plus Angebote und Neuheiten, wenn du magst.", email: "Deine E-Mail-Adresse", go: "Code holen", no: "Nein danke", done: "Dein Code:", doneSub: "Gib ihn an der Kasse ein. Er gilt 60 Tage für deine erste Bestellung.", copy: "Kopieren", copied: "Kopiert ✓", shop: "Jetzt einkaufen", legal: "Mit dem Absenden stimmst du zu, dass wir dir Angebote per E-Mail schicken. Abmelden jederzeit möglich." },
  en: { kicker: "Welcome gift", title: "10 % off your first order", sub: "Enter your email and get your code right away – plus offers and new arrivals if you like.", email: "Your email address", go: "Get my code", no: "No thanks", done: "Your code:", doneSub: "Enter it at checkout. Valid 60 days on your first order.", copy: "Copy", copied: "Copied ✓", shop: "Start shopping", legal: "By submitting you agree to receive offers by email. You can unsubscribe at any time." },
};

export function WelcomePopup({ lang, signedIn, photo }: { lang: "de" | "en"; signedIn: boolean; photo: string }) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<AccountState, FormData>(joinWithEmail, null);

  useEffect(() => {
    if (signedIn || /^\/(checkout|account|order|admin|manager)/.test(location.pathname)) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const show = () => setOpen(true);
    const timer = setTimeout(show, 9000);
    const leave = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };
    document.addEventListener("mouseleave", leave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", leave);
    };
  }, [signedIn]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, state?.code ? "code" : "closed");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (state?.code) {
      try {
        localStorage.setItem(KEY, "code");
      } catch {
        /* ignore */
      }
    }
  }, [state?.code]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={close}>
      <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-paper shadow-2xl sm:grid-cols-[1fr_1.1fr]" onClick={(e) => e.stopPropagation()}>
        <div className="relative hidden sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-4 top-4 rounded-full bg-terra px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{t.kicker}</span>
        </div>
        <div className="relative p-6 sm:p-8">
          <button type="button" onClick={close} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface" aria-label="Close">✕</button>
          {state?.code ? (
            <>
              <p className="text-sm font-semibold text-muted">{t.done}</p>
              <p className="display mt-2 text-3xl font-semibold tracking-wide text-forest" data-no-translate>{state.code}</p>
              <p className="mt-2 text-sm text-muted">{t.doneSub}</p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(state.code!).then(() => setCopied(true)).catch(() => null)}
                  className="btn btn-ghost flex-1"
                >
                  {copied ? t.copied : t.copy}
                </button>
                <button type="button" onClick={close} className="btn btn-primary flex-1">{t.shop}</button>
              </div>
            </>
          ) : (
            <form action={action}>
              <p className="text-xs font-bold uppercase tracking-wide text-terra sm:hidden">{t.kicker}</p>
              <h2 id="welcome-title" className="display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h2>
              <p className="mt-2 text-sm text-muted">{t.sub}</p>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <label className="label mt-5" htmlFor="welcome-email">{t.email}</label>
              <input id="welcome-email" name="email" type="email" required inputMode="email" autoComplete="email" className="input text-base" />
              {state?.error && <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p>}
              <button disabled={pending} className="btn btn-primary mt-3 min-h-12 w-full text-base font-bold">{pending ? "…" : t.go}</button>
              <button type="button" onClick={close} className="mt-2 w-full py-2 text-sm text-muted underline">{t.no}</button>
              <p className="mt-3 text-[0.6875rem] leading-snug text-muted">{t.legal}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
