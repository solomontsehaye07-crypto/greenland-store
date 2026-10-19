"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/(shop)/actions";

export function LangSwitch({ lang }: { lang: "de" | "en" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center text-xs" role="group" aria-label="Sprache / Language">
      {(["de", "en"] as const).map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="px-1 text-line" aria-hidden>/</span>}
          <button
            type="button"
            disabled={pending}
            aria-pressed={lang === l}
            onClick={() => start(async () => { await setLang(l); router.refresh(); })}
            className={`py-1 uppercase ${lang === l ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
