"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/(shop)/actions";

export function LangSwitch({ lang }: { lang: "de" | "en" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold" role="group" aria-label="Sprache / Language">
      {(["de", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={lang === l}
          onClick={() => start(async () => { await setLang(l); router.refresh(); })}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${lang === l ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
