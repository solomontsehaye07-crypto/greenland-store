import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "@fontsource/noto-sans-ethiopic/400.css";
import "@fontsource/noto-sans-ethiopic/600.css";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { AdminTranslator } from "@/components/admin/translator";
import { AdminPrefs } from "@/components/admin/prefs";
import { ManagerTabs } from "./tabs";

export const metadata: Metadata = {
  title: "Greenland Manager",
  manifest: "/manager/manifest.webmanifest",
  robots: { index: false },
  appleWebApp: { capable: true, title: "GL Manager", statusBarStyle: "black-translucent" },
  icons: { apple: "/brand/greenland-icon-512.png" },
};
export const viewport: Viewport = { themeColor: "#1D5C3F", width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireStaff(MANAGER_ROLES);
  const jar = await cookies();
  const lang = jar.get("admin_lang")?.value === "ti" ? "ti" : "en";
  const theme = ["light", "dark"].includes(jar.get("admin_theme")?.value ?? "") ? jar.get("admin_theme")!.value : "system";
  const tr = lang === "ti" ? (await supabaseAdmin().from("settings").select("value").eq("key", "private.admin_ti").maybeSingle()).data : null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date()));
  const hello = hour < 11 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="admin min-h-screen pb-24" data-lang={lang} data-theme={theme}>
      <header className="sticky top-0 z-20 border-b border-line bg-[var(--card)]/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/greenland-mark.svg" alt="" className="h-7 w-auto" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{hello}{profile.full_name ? <span data-no-translate>, {profile.full_name.split(" ")[0]}</span> : ""}</p>
              <p className="text-[0.6875rem] text-muted" data-no-translate>{new Date().toLocaleDateString(lang === "ti" ? "ti-ER" : "de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" })}</p>
            </div>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface">⋯</summary>
            <div className="absolute right-0 top-9 z-30 w-56 space-y-3 rounded-xl border border-line bg-[var(--card)] p-3 shadow-xl">
              <AdminPrefs lang={lang} theme={theme} />
              <Link href="/admin" className="block text-sm font-medium text-forest">Open full admin</Link>
              <Link href="/" className="block text-sm text-muted">View shop</Link>
              <p className="truncate text-[0.6875rem] text-muted" data-no-translate>{user.email}</p>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <ManagerTabs />
      <AdminTranslator lang={lang} overrides={(tr?.value as Record<string, string>) ?? {}} />
    </div>
  );
}
