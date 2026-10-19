"use client";

/** A checkbox that ticks or clears every checkbox with the given name inside the same form. */
export function SelectAll({ name = "ids", label = "Select all" }: { name?: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-[var(--forest)]"
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        form.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
