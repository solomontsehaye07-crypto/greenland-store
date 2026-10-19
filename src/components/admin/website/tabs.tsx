"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/admin/website", "Home page"],
  ["/admin/website/site", "Site settings"],
  ["/admin/website/theme", "Colours"],
  ["/admin/website/pages", "Pages"],
  ["/admin/website/media", "Media"],
] as const;

export function WebsiteTabs() {
  const path = usePathname();
  const active = (href: string) => (href === "/admin/website" ? path === href || path.startsWith("/admin/website/section") : path.startsWith(href));
  return (
    <nav aria-label="Website editor" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${active(href) ? "bg-ink text-paper" : "bg-white hover:bg-surface"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
