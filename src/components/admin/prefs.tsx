"use client";

const setCookie = (k: string, v: string) => {
  document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`;
};

/** Language and light/dark switch for the admin. The shop, emails, PDFs and reports are not affected. */
export function AdminPrefs({ lang, theme, easy = false }: { lang: string; theme: string; easy?: boolean }) {
  return (
    <div className="space-y-2" data-no-translate>
      <div className="flex rounded-lg bg-surface p-0.5 text-[0.6875rem]" role="group" aria-label="Admin language">
        {[["en", "English"], ["ti", "ትግርኛ"]].map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={lang === k}
            onClick={() => {
              setCookie("admin_lang", k);
              location.reload();
            }}
            className={`flex-1 rounded-md px-2 py-1 font-medium ${lang === k ? "bg-[var(--card)] shadow-sm" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex rounded-lg bg-surface p-0.5 text-[0.6875rem]" role="group" aria-label="Colour mode">
        {[["system", "Auto", "ኣውቶ"], ["light", "Light", "ብሩህ"], ["dark", "Dark", "ጸልማት"]].map(([k, l, ti]) => (
          <button
            key={k}
            type="button"
            aria-pressed={theme === k}
            onClick={() => {
              setCookie("admin_theme", k);
              document.querySelector(".admin")?.setAttribute("data-theme", k);
            }}
            className={`flex-1 rounded-md px-2 py-1 font-medium ${theme === k ? "bg-[var(--card)] shadow-sm" : "text-muted"}`}
          >
            {lang === "ti" ? ti : l}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={easy}
        onClick={() => {
          const next = !easy;
          setCookie("admin_easy", next ? "1" : "0");
          document.querySelector(".admin")?.toggleAttribute("data-easy", next);
          location.reload();
        }}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold ${easy ? "bg-ink text-white" : "bg-surface"}`}
      >
        <span>{lang === "ti" ? "ቀሊል ምርኣይ (ዓብዪ ጽሑፍ)" : "Easy view (large & clear)"}</span>
        <span aria-hidden>{easy ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}
