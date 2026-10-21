"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AIcon } from "@/components/admin/nav";

const TABS = [
  ["/manager", "Today", "home"],
  ["/manager/orders", "Orders", "orders"],
  ["/manager/stock", "Stock", "box"],
  ["/manager/money", "Money", "chart"],
  ["/manager/controls", "Controls", "gear"],
] as const;

export function ManagerTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Manager" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map(([href, label, icon]) => {
          const on = href === "/manager" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold ${on ? "text-forest" : "text-muted"}`}>
                <AIcon name={icon} size={24} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
