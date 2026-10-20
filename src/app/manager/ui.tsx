import Link from "next/link";

export function Tile({ label, value, sub, href, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-forest" : tone === "warn" ? "text-saffron" : tone === "bad" ? "text-terra" : "";
  const inner = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`display mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-4";
  return href ? <Link href={href} className={`${cls} hover:border-forest`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Msg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="status" className="mb-4 rounded-xl bg-forest/10 px-4 py-3 text-sm font-medium text-forest">{msg}</p>;
}
