"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "/steuerberater", label: "Kassenbuch (Laden)" },
  { href: "/steuerberater/online", label: "Online-Shop" },
  { href: "/steuerberater/protokoll", label: "Änderungsprotokoll" },
];

/** Left navigation of the portal; keeps the chosen month when switching books. */
export function PortalNav() {
  const path = usePathname();
  const m = useSearchParams().get("m");
  return (
    <nav aria-label="Bücher" className="flex gap-1 overflow-x-auto md:flex-col md:gap-0">
      {ITEMS.map((i) => {
        const on = path === i.href;
        return (
          <Link
            key={i.href}
            href={m ? `${i.href}?m=${m}` : i.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap border-l-4 px-3 py-2 ${on ? "border-[#2b6cb0] bg-white font-semibold text-[#1f5288]" : "border-transparent text-[#333] hover:bg-[#e6eef8]"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
