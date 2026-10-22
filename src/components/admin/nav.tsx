"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MagnifierToggle } from "./magnifier";

// 20px line icons for the admin navigation.
const I: Record<string, React.ReactNode> = {
  home: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  orders: <><path d="M6 4h12v16l-3-2-3 2-3-2-3 2z" /><path d="M9 9h6M9 13h4" /></>,
  box: <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>,
  tag: <><path d="M4 12V5h7l9 9-7 7z" /><circle cx="8" cy="9" r="1.3" /></>,
  chart: <><path d="M5 19V5M5 19h14" /><path d="M9 15l3-4 3 2 4-6" /></>,
  refill: <><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  people: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /><path d="M16 6.5a2.5 2.5 0 0 1 0 5M17 14.5c1.8.4 3 1.8 3.5 4.5" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 15v4h14v-4" /></>,
  layout: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 10v10" /></>,
  palette: <><path d="M12 4a8 8 0 1 0 0 16c1.2 0 1.6-.9 1.2-1.8-.5-1 .1-2.2 1.3-2.2H17a3 3 0 0 0 3-3c0-5-3.6-9-8-9z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 17l5-4.5 4 3.5 2-1.5 3 2.5" /></>,
  page: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  pot: <><path d="M5 10h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" /><path d="M3 10h18M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  store: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M5 11v9h14v-9" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
};

export function AIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {I[name] ?? I.box}
    </svg>
  );
}

type Item = { href: string; label: string; icon: string; exact?: boolean; roles?: string[] };
const M = ["manager", "admin"];
export const NAV_GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "",
    items: [{ href: "/admin", label: "Overview", icon: "home", exact: true }],
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders" },
      { href: "/admin/products", label: "Products", icon: "box" },
      { roles: M, href: "/admin/pricing", label: "Pricing", icon: "tag" },
      { roles: M, href: "/admin/finance", label: "Profit & loss", icon: "chart" },
      { roles: M, href: "/admin/reports", label: "Reports", icon: "page" },
      { roles: ["admin"], href: "/admin/buchhaltung", label: "Bookkeeping", icon: "page" },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/admin/goods-in", label: "Goods in", icon: "box" },
      { href: "/admin/purchase-orders", label: "Refill requests", icon: "refill" },
      { href: "/admin/suppliers", label: "Suppliers", icon: "people" },
      { href: "/admin/import", label: "Batch import", icon: "upload" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/admin/website", label: "Home page", icon: "layout", exact: true },
      { href: "/admin/website/designs", label: "Designs & seasons", icon: "sparkle" },
      { href: "/admin/website/media", label: "Media", icon: "image" },
      { href: "/admin/website/pages", label: "Pages", icon: "page" },
      { href: "/admin/recipes", label: "Recipes", icon: "pot" },
      { href: "/admin/reviews", label: "Reviews", icon: "sparkle" },
      { href: "/admin/subscribers", label: "Subscribers", icon: "mail" },
    ],
  },
  {
    label: "Settings",
    items: [
      { roles: M, href: "/admin/settings/shipping", label: "Shipping & pickup", icon: "truck" },
      { roles: M, href: "/admin/settings/payments", label: "Payments", icon: "card" },
      { href: "/admin/website/site", label: "Shop details", icon: "store" },
      { roles: M, href: "/admin/settings", label: "Account & receipts", icon: "gear", exact: true },
      { roles: ["admin"], href: "/admin/team", label: "Team & roles", icon: "people" },
      { href: "/admin/translations", label: "Translations", icon: "page" },
    ],
  },
];

function isActive(path: string, href: string, exact?: boolean) {
  if (exact) return path === href || (href === "/admin/website" && path.startsWith("/admin/website/section"));
  return path === href || path.startsWith(href + "/");
}

function Links({ onNavigate, role }: { onNavigate?: () => void; role: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-5">
      {NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length).map((g) => (
        <div key={g.label || "top"}>
          {g.label && <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold text-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const on = isActive(path, it.href, it.exact);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors ${on ? "bg-forest text-white" : "text-ink hover:bg-surface"}`}
                  >
                    <AIcon name={it.icon} className={on ? "" : "text-muted"} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav({ email, signOut, role, prefs }: { email: string; signOut: React.ReactNode; role: string; prefs: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const footer = (
    <div className="space-y-3 border-t border-line pt-4 text-xs text-muted">
      {prefs}
      {M.includes(role) && <Link href="/manager" className="block rounded-lg bg-forest/10 px-3 py-2 font-semibold text-forest hover:bg-forest/15">Open Manager app</Link>}
      <p className="truncate" title={email}>{email}</p>
      <div className="flex items-center gap-4">
        <Link href="/" className="font-medium text-forest hover:underline">View shop</Link>
        {signOut}
      </div>
    </div>
  );
  return (
    <>
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center justify-between pr-3">
          <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/greenland-mark.svg?v=3" alt="" className="h-7 w-auto" />
            <span className="display text-[0.9375rem] font-semibold">Greenland admin</span>
          </Link>
          <MagnifierToggle />
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <Links role={role} />
        </div>
        <div className="px-5 pb-5">{footer}</div>
      </aside>

      {/* mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/greenland-mark.svg?v=3" alt="" className="h-6 w-auto" />
          <span className="display text-sm font-semibold">Admin</span>
        </Link>
        <div className="flex items-center gap-1">
          <MagnifierToggle />
          <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-surface" aria-label="Open menu">
            <AIcon name="menu" size={22} />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="display font-semibold">Greenland admin</span>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface" aria-label="Close menu">
                <AIcon name="close" size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 pb-4"><Links role={role} onNavigate={() => setOpen(false)} /></div>
            <div className="px-5 pb-5">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}
