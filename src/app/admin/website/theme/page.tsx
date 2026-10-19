import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_THEME } from "@/lib/sections";
import { ThemeForm } from "./theme-form";

export const dynamic = "force-dynamic";

export default async function ThemePage() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.theme").maybeSingle();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Colours</h2>
        <p className="mt-1 text-sm text-muted">The shop’s palette. Keep the text colour dark and the page background light so everything stays easy to read.</p>
      </div>
      <ThemeForm initial={{ ...DEFAULT_THEME, ...((data?.value as object) ?? {}) }} />
    </div>
  );
}
