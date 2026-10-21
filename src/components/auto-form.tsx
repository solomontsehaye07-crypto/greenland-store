"use client";

import { useRef } from "react";

/** A form that saves itself shortly after you change a field, or when you leave it / press Enter. */
export function AutoForm({ action, children, className }: { action: (fd: FormData) => Promise<void>; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const submit = () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      ref.current?.requestSubmit();
    }
  };
  return (
    <form
      ref={ref}
      action={action}
      className={className}
      onChange={() => {
        dirty.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(submit, 1500);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) submit();
      }}
      onSubmit={() => {
        dirty.current = false;
        if (timer.current) clearTimeout(timer.current);
      }}
    >
      {children}
    </form>
  );
}
