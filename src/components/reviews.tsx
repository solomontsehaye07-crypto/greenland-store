"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/(shop)/p/[slug]/actions";

export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 text-saffron ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <defs>
              <linearGradient id={`s${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="var(--line)" />
              </linearGradient>
            </defs>
            <path fill={`url(#s${i}-${Math.round(fill * 100)})`} d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
          </svg>
        );
      })}
    </span>
  );
}

const T = {
  de: { write: "Bewertung schreiben", edit: "Deine Bewertung ändern", signIn: "Melde dich an, um eine Bewertung zu schreiben", rating: "Deine Sterne", body: "Was gefällt dir – oder was nicht? (optional)", send: "Bewertung speichern", thanks: "Danke! Deine Bewertung ist online.", hint: "Dein Vorname und der erste Buchstabe deines Nachnamens werden angezeigt." },
  en: { write: "Write a review", edit: "Change your review", signIn: "Sign in to write a review", rating: "Your stars", body: "What do you like – or not? (optional)", send: "Save review", thanks: "Thank you! Your review is online.", hint: "Your first name and the first letter of your last name are shown." },
};

export function ReviewForm({ productId, slug, signedIn, mine, lang }: { productId: number; slug: string; signedIn: boolean; mine: { rating: number; body: string | null } | null; lang: "de" | "en" }) {
  const t = T[lang];
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [hover, setHover] = useState(0);
  if (!signedIn)
    return (
      <Link href={`/account?next=${encodeURIComponent(`/p/${slug}#bewertungen`)}`} className="btn btn-ghost">
        {t.signIn}
      </Link>
    );
  if (state.ok) return <p className="rounded-xl bg-forest/10 px-4 py-3 text-sm text-forest" role="status">{t.thanks}</p>;
  return (
    <details className="group rounded-2xl border border-line bg-white p-4" open={!!state.error}>
      <summary className="cursor-pointer list-none text-sm font-semibold">{mine ? t.edit : t.write} <span className="text-muted group-open:hidden">+</span></summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="rating" value={rating} />
        <fieldset>
          <legend className="label">{t.rating}</legend>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                aria-label={`${i} / 5`}
                aria-pressed={rating === i}
                className={`text-3xl leading-none transition-colors ${(hover || rating) >= i ? "text-saffron" : "text-line"}`}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="rv-body">{t.body}</label>
          <textarea id="rv-body" name="body" rows={4} maxLength={1200} defaultValue={mine?.body ?? ""} className="input" />
        </div>
        <p className="text-xs text-muted">{t.hint}</p>
        {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        <button className="btn btn-primary" disabled={pending || !rating}>{pending ? "…" : t.send}</button>
      </form>
    </details>
  );
}
