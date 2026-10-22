import { Suspense } from "react";
import { requireAdvisor } from "@/lib/auth";
import { portalSignOut } from "../login/actions";
import { PortalNav } from "./portal-nav";

export const metadata = { title: { absolute: "Kanzlei-Zugang – Greenland Afro Asia Store" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Separate area for the tax advisor: only the two books and the change log. No shop, no admin.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdvisor();
  return (
    <div className="stb min-h-screen">
      <header className="bg-forest text-white">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-x-6 gap-y-2 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/greenland-icon.svg" alt="" width={34} height={34} className="rounded-md bg-white p-0.5" />
            <div className="leading-tight">
              <p className="display text-[16px] font-bold sm:text-[17px]">Greenland<span className="hidden sm:inline"> Afro Asia Store</span></p>
              <p className="hidden text-[12.5px] text-white/75 sm:block">Kanzlei-Zugang · Bücher und Kontierung</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="hidden max-w-[16rem] truncate text-white/85 md:inline">{profile.full_name || user.email}{profile.role === "admin" ? " · Inhaberin" : ""}</span>
            <form action={portalSignOut}>
              <button className="rounded-md border border-white/35 px-3 py-1.5 font-semibold hover:bg-white/10">Abmelden</button>
            </form>
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-[96rem] px-4 sm:px-6">
          <Suspense fallback={null}><PortalNav /></Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-[96rem] space-y-4 px-3 py-4 sm:px-6 sm:py-5">{children}</main>
    </div>
  );
}
