"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that asks for a second click before it submits (no browser dialog). */
export function ConfirmButton({ label = "Delete", confirmLabel = "Really delete?", className = "" }: { label?: string; confirmLabel?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type={armed ? "submit" : "button"}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      disabled={pending}
      aria-live="polite"
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${armed ? "bg-danger text-white" : "text-danger hover:bg-danger/10"} ${className}`}
    >
      {pending ? "Deleting…" : armed ? confirmLabel : label}
    </button>
  );
}

/** A small submit button that shows a pending state. */
export function SubmitButton({ children, className = "btn btn-ghost py-1.5 text-sm", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
