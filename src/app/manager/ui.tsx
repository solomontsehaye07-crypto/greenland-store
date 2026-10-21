import Link from "next/link";
import { AIcon } from "@/components/admin/nav";

export type TileColor = "money" | "money2" | "money3" | "order" | "order2" | "order3" | "order4" | "stock" | "stock2" | "stock3" | "product" | "product2" | "loss" | "wait";

/** A solid colour-coded block. Related areas share a colour family:
 *  money = greens, customer orders = ambers/browns, stock & suppliers = blues, products & offers = purples, losses = red. */
export function Tile({ label, value, sub, href, color = "money", icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; color?: TileColor; icon?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{label}</p>
        {icon && <span className="mt-c-ic grid h-7 w-7 place-items-center rounded-lg"><AIcon name={icon} size={16} /></span>}
      </div>
      <p className="display mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-c-sub mt-0.5 text-xs">{sub}</p>}
    </>
  );
  const cls = `mt-c mt-${color} block rounded-2xl p-4 transition-colors`;
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

/** Colour-coded quick link. */
export function QuickLink({ href, label, color, icon }: { href: string; label: string; color: TileColor; icon: string }) {
  return (
    <Link href={href} className={`mt-c mt-${color} flex items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-semibold`}>
      <span className="mt-c-ic grid h-8 w-8 shrink-0 place-items-center rounded-lg"><AIcon name={icon} size={17} /></span>
      {label}
    </Link>
  );
}

export function Section({ title, action, children, color }: { title: string; action?: React.ReactNode; children: React.ReactNode; color?: TileColor }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        {color ? <h2 className={`mt-c mt-${color} rounded-lg px-3 py-1.5 text-sm font-semibold`}>{title}</h2> : <h2 className="text-sm font-semibold">{title}</h2>}
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

/** Sub-tabs inside Orders: customer orders and orders to suppliers. */
export function OrdersNav({ active }: { active: "customers" | "suppliers" | "invoices" }) {
  const item = (key: "customers" | "suppliers" | "invoices", href: string, label: string, color: TileColor) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex flex-1 items-center justify-center rounded-xl px-2 py-2.5 text-center text-sm font-semibold leading-tight ${active === key ? `mt-c mt-${color}` : "border border-line bg-white text-muted"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Orders" className="mb-5 flex gap-2">
      {item("customers", "/manager/orders", "Customer orders", "order")}
      {item("suppliers", "/manager/orders/suppliers", "Order from suppliers", "stock2")}
      {item("invoices", "/manager/orders/invoices", "Invoices", "money2")}
    </nav>
  );
}

/** Clear back button: solid, with an arrow and the word "Back" (not just a small "‹"). */
export function BackButton({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-ink pl-2.5 pr-4 text-base font-bold text-white shadow-sm active:opacity-80" aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Back
    </Link>
  );
}
