"use client";

import { useEffect, useRef, useState } from "react";

// Quantity you can type (number keypad on phones) or nudge with − / +. The number changes at once on
// screen; it is saved shortly after you stop, when you leave the box, or when you press Enter/Go.
export function QtyField({
  action,
  qty,
  label,
  children,
  compact = false,
}: {
  action: (fd: FormData) => Promise<void>;
  qty: number;
  label: string;
  children: React.ReactNode; // hidden fields (item id, page state)
  compact?: boolean; // small stepper for lists
}) {
  const [v, setV] = useState(String(qty));
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    setV(String(qty));
    setSaving(false);
    sent.current = null;
  }, [qty]);

  const n = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.min(9999, Math.round(Number(s)))));
  const changed = (s: string) => {
    const x = n(s);
    return x !== null && Number.isFinite(x) && x !== qty && String(x) !== sent.current;
  };
  const submit = () => {
    if (timer.current) clearTimeout(timer.current);
    if (changed(v)) form.current?.requestSubmit();
    else if (n(v) === null) setV(String(qty));
  };
  const later = (s: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (changed(s)) timer.current = setTimeout(() => form.current?.requestSubmit(), 1200);
  };
  const step = (d: number) => {
    const s = String(Math.max(0, (n(v) ?? qty) + d));
    setV(s);
    later(s);
  };

  return (
    <form
      ref={form}
      action={action}
      onSubmit={() => {
        if (timer.current) clearTimeout(timer.current);
        sent.current = String(n(v));
        setSaving(true);
        setTimeout(() => setSaving(false), 4000);
      }}
      className={`inline-flex items-center rounded-full border border-line bg-white ${saving ? "opacity-60" : ""}`}
    >
      {children}
      <button type="button" onClick={() => step(-1)} className={`${compact ? "h-9 w-9 text-xl" : "h-11 w-11 text-2xl"} font-bold text-muted`} aria-label={`One less ${label}`}>−</button>
      <input
        name="qty"
        value={v}
        onChange={(e) => {
          const s = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
          setV(s);
          later(s);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={submit}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        data-no-memory
        aria-label={`Quantity of ${label}`}
        className={`${compact ? "h-8 w-11 text-base" : "h-11 w-16 text-lg"} rounded-md bg-surface text-center font-bold tabular-nums outline-none focus:ring-2 focus:ring-forest`}
      />
      <button type="button" onClick={() => step(1)} className={`${compact ? "h-9 w-9 text-xl" : "h-11 w-11 text-2xl"} font-bold text-muted`} aria-label={`One more ${label}`}>+</button>
    </form>
  );
}
