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
export function OrdersNav({ active }: { active: "customers" | "suppliers" }) {
  const item = (key: "customers" | "suppliers", href: string, label: string, color: TileColor) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold ${active === key ? `mt-c mt-${color}` : "border border-line bg-white text-muted"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Orders" className="mb-5 flex gap-2">
      {item("customers", "/manager/orders", "Customer orders", "order")}
      {item("suppliers", "/manager/orders/suppliers", "Order from suppliers", "stock2")}
    </nav>
  );
}
