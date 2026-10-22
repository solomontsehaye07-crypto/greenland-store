import { Suspense } from "react";
import { requireAdvisor } from "@/lib/auth";
import { getAccountingSettings } from "@/lib/cashbook";
import { portalSignOut } from "../login/actions";
import { PortalNav } from "./portal-nav";

export const metadata = { title: { absolute: "Steuerberater-Portal – Greenland Afro Asia Store" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Separate area for the tax advisor: only the two books and the change log. No shop, no admin.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [{ user, profile }, acc] = await Promise.all([requireAdvisor(), getAccountingSettings()]);
  return (
    <div className="stb flex min-h-screen flex-col bg-[#ececec]">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b-2 border-[#b4232a] bg-white px-4 py-2">
        <div className="flex items-baseline gap-3">
          <p className="text-[15px] font-semibold text-[#333]">Steuerberater-Portal</p>
          <p className="text-[#666]">Greenland Afro Asia Store · Mandant {acc.client}</p>
        </div>
        <div className="flex items-center gap-3 text-[#555]">
          <span>{profile.full_name || user.email}{profile.role === "admin" ? " (Inhaberin)" : ""}</span>
          <form action={portalSignOut}>
            <button className="stb-btn">Abmelden</button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-[#c4c4c4] bg-[#f3f3f3] md:w-52 md:shrink-0 md:border-b-0 md:border-r md:pt-2">
          <Suspense fallback={null}><PortalNav /></Suspense>
        </aside>
        <main className="min-w-0 flex-1 p-3 md:p-4">{children}</main>
      </div>
    </div>
  );
}
