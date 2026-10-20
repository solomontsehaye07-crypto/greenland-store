import Link from "next/link";

/** Page title row used on every admin page. */
export function PageHead({ title, text, actions }: { title: string; text?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-sm text-muted">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A white card with an optional heading. */
export function Card({ title, text, children, className = "", actions }: { title?: string; text?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[0.9375rem] font-semibold">{title}</h2>}
            {text && <p className="mt-0.5 text-xs text-muted">{text}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The detail panel that slides in from the right, over the list it belongs to.
 * Closing goes back to `closeHref` (the list with the same filters).
 */
export function SidePanel({ title, subtitle, closeHref, children, footer, wide }: { title: string; subtitle?: React.ReactNode; closeHref: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} className="absolute inset-0 bg-ink/30 animate-[fade_.2s_ease-out_both]" aria-label="Close panel" />
      <aside
        role="dialog"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-paper shadow-2xl animate-[panel-in_.25s_cubic-bezier(.2,.7,.2,1)_both] ${wide ? "max-w-3xl" : "max-w-xl"}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>}
          </div>
          <Link href={closeHref} scroll={false} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-line bg-white px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

/** Small status message shown after a save (?msg=...). */
export function Notice({ msg }: { msg?: string }) {
  if (!msg) return null;
  const bad = /^(could not|error|please|enter|pick|product not)/i.test(msg);
  return (
    <p role="status" className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium ${bad ? "bg-danger/10 text-danger" : "bg-forest/10 text-forest"}`}>
      {msg}
    </p>
  );
}

export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="hidden" name={`${name}__present`} value="1" />
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-forest peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-forest" />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
