import Link from "next/link";
import { AIcon } from "@/components/admin/nav";

export type TileColor = "green" | "amber" | "blue" | "red" | "violet" | "teal";

/** A colour-coded block. Each area keeps its colour everywhere in the app:
 *  green = money, amber = orders to pack, blue = pickups/delivery, red = stock problems, violet = refill, teal = store. */
export function Tile({ label, value, sub, href, color = "green", icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; color?: TileColor; icon?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink/80">{label}</p>
        {icon && <span className="mt-c-ic grid h-7 w-7 place-items-center rounded-lg"><AIcon name={icon} size={16} /></span>}
      </div>
      <p className="mt-c-val display mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  );
  const cls = `mt-c mt-${color} block rounded-2xl p-4 transition-colors`;
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

/** Colour-coded quick link. */
export function QuickLink({ href, label, color, icon }: { href: string; label: string; color: TileColor; icon: string }) {
  return (
    <Link href={href} className={`mt-c mt-${color} flex items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-medium`}>
      <span className="mt-c-ic grid h-8 w-8 shrink-0 place-items-center rounded-lg"><AIcon name={icon} size={17} /></span>
      {label}
    </Link>
  );
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
