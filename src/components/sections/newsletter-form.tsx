"use client";

import { useActionState } from "react";
import { subscribe } from "@/app/(shop)/actions";

export function NewsletterForm({ lang, button, placeholder, thanks }: { lang: string; button: string; placeholder: string; thanks: string }) {
  const [state, action, pending] = useActionState(subscribe, null as null | { ok?: boolean; error?: string });
  if (state?.ok) return <p className="rounded-full bg-paper/15 px-5 py-3.5 font-semibold" role="status">{thanks}</p>;
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="lang" value={lang} />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label htmlFor="nl-email" className="sr-only">{placeholder}</label>
      <input id="nl-email" name="email" type="email" required placeholder={placeholder} className="h-12 flex-1 rounded-full border-0 bg-paper px-5 text-ink outline-none focus:ring-4 focus:ring-saffron/50" />
      <button disabled={pending} className="h-12 rounded-full bg-saffron px-6 font-semibold text-ink hover:brightness-105 disabled:opacity-60">{button}</button>
      {state?.error && <p className="text-sm font-medium sm:basis-full" role="alert">{state.error}</p>}
    </form>
  );
}
