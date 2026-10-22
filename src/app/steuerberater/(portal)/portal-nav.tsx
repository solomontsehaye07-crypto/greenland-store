"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const Folder = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><path d="M1 2.5h5l1.5 1.5H15v9H1z" fill="#f2c24f" stroke="#b98a1c" /></svg>
);
const Page = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true"><rect x="1.5" y="1.5" width="12" height="12" fill="#fff" stroke="#4d6f99" /><path d="M1.5 4.5h12" stroke="#4d6f99" /><path d="M4 7h7M4 9.5h7M4 12h5" stroke="#7d93b0" /></svg>
);

const TREE = [
  { group: "Kassenbuch Laden", items: [{ href: "/steuerberater", label: "Kassenbuch bearbeiten" }, { href: "/steuerberater/protokoll", label: "Änderungsprotokoll" }] },
  { group: "Online-Shop", items: [{ href: "/steuerberater/online", label: "Online-Buch ansehen" }] },
];

/** Navigation tree like Agenda's; keeps the chosen month when switching. */
export function PortalNav() {
  const path = usePathname();
  const m = useSearchParams().get("m");
  return (
    <nav aria-label="Navigation" className="stb-tree py-1">
      {TREE.map((g) => (
        <div key={g.group}>
          <p className="flex items-center gap-1.5 px-2 py-[3px]"><span aria-hidden="true" className="text-[9px] text-[#666]">◢</span><Folder />{g.group}</p>
          <ul className="pl-6">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link href={m ? `${i.href}?m=${m}` : i.href} aria-current={path === i.href ? "page" : undefined}><Page />{i.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
