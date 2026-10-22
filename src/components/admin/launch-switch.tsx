import { revalidatePath } from "next/cache";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function setLive(fd: FormData) {
  "use server";
  await assertStaff(MANAGER_ROLES);
  const live = fd.get("live") === "true";
  await supabaseAdmin().from("settings").upsert({ key: "public.launch", value: { live, changed_at: new Date().toISOString() } }, { onConflict: "key" });
  revalidatePath("/admin");
}

/** Banner on the admin overview: is the shop public on greenland-afroasia.de, or showing "coming soon"? */
export async function LaunchSwitch() {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.launch").maybeSingle();
  const live = (data?.value as { live?: boolean } | null)?.live !== false;
  return (
    <form action={setLive} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 ${live ? "border border-line bg-white" : "bg-saffron/20"}`}>
      <input type="hidden" name="live" value={live ? "false" : "true"} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{live ? "The shop is public on greenland-afroasia.de" : "The shop is hidden – greenland-afroasia.de shows “Bald geöffnet”"}</p>
        <p className="text-xs text-muted">
          {live
            ? "Hide it again to show the coming-soon page. Admin and the Manager app keep working either way."
            : "You can still use the full shop at greenland-store.solomon-tsehaye07.workers.dev. The switch takes up to a minute."}
        </p>
      </div>
      <button className={`btn shrink-0 ${live ? "btn-ghost" : "btn-primary"}`}>{live ? "Hide the shop" : "Go live"}</button>
    </form>
  );
}
