"use client";

import { useActionState } from "react";
import { subscribe } from "@/app/(shop)/actions";

export function NewsletterForm({ lang, button, placeholder, thanks }: { lang: string; button: string; placeholder: string; thanks: string }) {
  const [state, action, pending] = useActionState(subscribe, null as null | { ok?: boolean; error?: string });
  if (state?.ok) return <p className="text-sm font-medium text-forest" role="status">{thanks}</p>;
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="lang" value={lang} />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label htmlFor="nl-email" className="sr-only">{placeholder}</label>
      <input id="nl-email" name="email" type="email" required placeholder={placeholder} className="input h-11 flex-1 rounded-full bg-white px-5" />
      <button disabled={pending} className="btn btn-primary h-11 px-6 disabled:opacity-60">{button}</button>
      {state?.error && <p className="text-sm font-medium sm:basis-full" role="alert">{state.error}</p>}
    </form>
  );
}
