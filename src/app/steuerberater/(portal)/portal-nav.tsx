"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS: { href: string; label: string; short?: string }[] = [
  { href: "/steuerberater", label: "Kassenbuch Laden" },
  { href: "/steuerberater/online", label: "Online-Shop" },
  { href: "/steuerberater/protokoll", label: "Änderungsprotokoll", short: "Protokoll" },
];

/** Tabs in the top band; the chosen month stays when switching. */
export function PortalNav() {
  const path = usePathname();
  const m = useSearchParams().get("m");
  return (
    <nav aria-label="Bereiche" className="stb-tabs flex gap-5 overflow-x-auto [scrollbar-width:none] sm:gap-6">
      {TABS.map((t) => (
        <Link key={t.href} href={m && t.href !== "/steuerberater/protokoll" ? `${t.href}?m=${m}` : t.href} aria-current={path === t.href ? "page" : undefined}>{t.short ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}</Link>
      ))}
    </nav>
  );
}
