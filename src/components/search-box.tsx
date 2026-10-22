"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { img } from "@/lib/img";
import { money } from "@/lib/format";
import { Icon } from "./icons";

type Hit = {
  slug: string;
  title: string;
  title_de: string | null;
  brand: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  stock: number;
};

const T = {
  de: { all: (q: string) => `Alle Ergebnisse für „${q}“`, none: "Keine Treffer – versuch ein anderes Wort.", loading: "Suche …", out: "ausverkauft" },
  en: { all: (q: string) => `All results for “${q}”`, none: "No matches – try another word.", loading: "Searching…", out: "sold out" },
};

/**
 * Search field with suggestions while you type. Enter (or the button) still opens the full results page.
 * variant "bar": header search with a button; "pill": plain rounded field (mobile menu);
 * "page": the search page – there the results below update while typing as well.
 */
export function SearchBox({
  lang,
  placeholder,
  label,
  variant = "bar",
  defaultValue = "",
  autoFocus = false,
}: {
  lang: "de" | "en";
  placeholder: string;
  label: string;
  variant?: "bar" | "pill" | "page";
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const t = T[lang];
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(defaultValue);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const seq = useRef(0);

  // fetch suggestions shortly after typing stops
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const j = (await r.json()) as { items: Hit[] };
        if (n === seq.current) {
          setHits(j.items ?? []);
          setActive(-1);
        }
      } catch {
        if (n === seq.current) setHits([]);
      } finally {
        if (n === seq.current) setLoading(false);
      }
      // on the search page the full results follow the typing too
      if (variant === "page" && n === seq.current) router.replace(`/search?q=${encodeURIComponent(term)}`, { scroll: false });
    }, 220);
    return () => clearTimeout(timer);
  }, [q, variant, router]);

  // close when tapping elsewhere
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const term = q.trim();
  const showList = open && term.length >= 2 && variant !== "page";
  const listId = `${id}-list`;
  const name = (h: Hit) => (lang === "de" ? h.title_de || h.title : h.title);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter" && active >= 0 && hits[active]) {
      e.preventDefault();
      go(`/p/${hits[active].slug}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const formClass = variant === "bar" ? "search-bar relative flex w-full" : "relative w-full";
  const inputClass = variant === "bar" ? "" : "input rounded-full";

  return (
    <form
      ref={box}
      action="/search"
      role="search"
      className={formClass}
      onSubmit={(e) => {
        e.preventDefault();
        if (term) go(`/search?q=${encodeURIComponent(term)}`);
      }}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        name="q"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={inputClass}
      />
      {variant === "bar" && (
        <button type="submit" aria-label={label}><Icon name="search" size={20} /></button>
      )}

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white text-left shadow-[0_24px_48px_-24px_rgba(0,0,0,.35)]">
          <ul id={listId} role="listbox" aria-label={label} className="max-h-[60vh] overflow-y-auto py-1">
            {hits.map((h, i) => (
              <li key={h.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  href={`/p/${h.slug}`}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 px-3 py-2 ${i === active ? "bg-surface" : ""}`}
                >
                  {h.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(h.image_url, 96)} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-surface object-cover mix-blend-multiply" loading="lazy" />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-lg bg-surface" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    {h.brand && <span className="block truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">{h.brand}</span>}
                    <span className="block truncate text-sm text-ink">{name(h)}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {money(h.price)}
                    {h.stock <= 0 && <span className="block text-[0.6875rem] font-normal text-muted">{t.out}</span>}
                  </span>
                </Link>
              </li>
            ))}
            {!hits.length && <li className="px-4 py-3 text-sm text-muted">{loading ? t.loading : t.none}</li>}
          </ul>
          {hits.length > 0 && (
            <Link href={`/search?q=${encodeURIComponent(term)}`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-sm font-semibold text-forest hover:bg-surface">
              {t.all(term)}
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
