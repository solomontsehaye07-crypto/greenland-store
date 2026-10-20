"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** Saves corrections and new Tigrinya texts for the admin screens. Empty values remove a correction. */
export async function saveTranslations(changes: Record<string, string>): Promise<{ ok?: string; error?: string }> {
  try {
    await assertStaff();
    const sb = supabaseAdmin();
    const { data } = await sb.from("settings").select("value").eq("key", "private.admin_ti").maybeSingle();
    const cur = { ...((data?.value as Record<string, string>) ?? {}) };
    for (const [k, v] of Object.entries(changes)) {
      const key = k.trim().slice(0, 400);
      if (!key) continue;
      if (v.trim()) cur[key] = v.trim().slice(0, 600);
      else delete cur[key];
    }
    const { error } = await sb.from("settings").upsert({ key: "private.admin_ti", value: cur }, { onConflict: "key" });
    if (error) return { error: error.message };
    revalidatePath("/admin", "layout");
    return { ok: `Saved. ${Object.keys(changes).length} texts updated.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Saving failed." };
  }
}
