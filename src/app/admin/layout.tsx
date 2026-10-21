import { cookies } from "next/headers";
import "@fontsource/noto-sans-ethiopic/400.css";
import "@fontsource/noto-sans-ethiopic/600.css";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { AdminNav } from "@/components/admin/nav";
import { AdminTranslator } from "@/components/admin/translator";
import { AdminPrefs } from "@/components/admin/prefs";
import { FieldMemory } from "@/components/field-memory";
import { signOut } from "./actions";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang = jar.get("admin_lang")?.value === "ti" ? "ti" : "en";
  const theme = ["light", "dark"].includes(jar.get("admin_theme")?.value ?? "") ? jar.get("admin_theme")!.value : "system";
  const easy = jar.get("admin_easy")?.value === "1";
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const shell = (inner: React.ReactNode, overrides: Record<string, string> = {}) => (
    <div className="admin min-h-screen" data-lang={lang} data-theme={theme} data-easy={easy ? "" : undefined} lang={lang === "ti" ? "ti" : "en"}>
      {inner}
      <AdminTranslator lang={lang} overrides={overrides} />
      <FieldMemory seedsUrl={user ? "/api/admin/suggest" : undefined} />
    </div>
  );
  if (!user) return shell(children);
  const [{ data: profile }, { data: tr }] = await Promise.all([
    sb.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    lang === "ti" ? supabaseAdmin().from("settings").select("value").eq("key", "private.admin_ti").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return shell(
    <div className="lg:flex">
      <AdminNav
        email={user.email ?? ""}
        role={(profile?.role as string) ?? "staff"}
        prefs={<AdminPrefs lang={lang} theme={theme} easy={easy} />}
        signOut={
          <form action={signOut}>
            <button className="font-medium text-muted hover:text-ink hover:underline">Sign out</button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>,
    (tr?.value as Record<string, string>) ?? {}
  );
}
