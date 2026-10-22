import { Suspense } from "react";
import { requireAdvisor } from "@/lib/auth";
import { portalSignOut } from "../login/actions";
import { PortalNav } from "./portal-nav";

export const metadata = { title: { absolute: "Steuerberater-Portal – Greenland Afro Asia Store" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Separate area for the tax advisor: only the two books and the change log. No shop, no admin.
// Built to look like the Agenda Unternehmens-Portal the office already knows.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdvisor();
  const who = profile.full_name ? `${profile.full_name} (${user.email})` : user.email;
  return (
    <div className="stb flex min-h-screen flex-col border-t-[3px] border-[#c0222b] bg-[#e9e9e9]">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-[#c3c3c3] bg-white px-3 py-2">
        <p className="stb-brand text-[22px] leading-none tracking-tight"><span className="font-bold">Greenland:</span> Steuerberater-Portal</p>
        <div className="flex items-center gap-3 text-[#333]">
          <span>Angemeldet als {who}</span>
          <form action={portalSignOut}><button className="stb-btn">Abmelden</button></form>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-1 p-1 md:flex-row">
        <aside className="stb-box flex flex-col bg-white md:w-60 md:shrink-0">
          <p className="stb-bar">Navigation</p>
          <Suspense fallback={null}><PortalNav /></Suspense>
        </aside>
        <main className="stb-box flex min-w-0 flex-1 flex-col bg-white">{children}</main>
      </div>
    </div>
  );
}
