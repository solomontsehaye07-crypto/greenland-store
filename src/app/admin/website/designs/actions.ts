"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { normalise, storeFrom, type Design, type DesignStore } from "@/lib/designs";
import type { FormState } from "../actions";

async function load(): Promise<DesignStore> {
  const { data } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.designs", "public.theme"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  return storeFrom(get("public.designs"), get("public.theme") as Record<string, string> | undefined);
}

async function save(store: DesignStore) {
  const { error } = await supabaseAdmin().from("settings").upsert({ key: "public.designs", value: store }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveDesign(id: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertStaff();
    const raw = JSON.parse(String(fd.get("data") ?? "{}")) as Partial<Design>;
    const from = String(raw.from ?? "").trim();
    const to = String(raw.to ?? "").trim();
    if ((from || to) && !(DATE.test(from) && DATE.test(to))) throw new Error("Dates must look like 2026-12-01. Fill in both or leave both empty.");
    const store = await load();
    const i = store.presets.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("This design no longer exists.");
    store.presets[i] = normalise({ ...store.presets[i], ...raw, id, from: from || undefined, to: to || undefined, name: String(raw.name || store.presets[i].name).slice(0, 60) });
    await save(store);
    return { ok: "Saved. If this design is on, the shop shows it now.", at: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Saving failed." };
  }
}

export async function switchDesign(fd: FormData) {
  await assertStaff();
  const store = await load();
  const id = String(fd.get("id"));
  if (store.presets.some((p) => p.id === id)) store.active = id;
  await save(store);
  redirect("/admin/website/designs?msg=Design switched on.");
}

export async function duplicateDesign(fd: FormData) {
  await assertStaff();
  const store = await load();
  const src = store.presets.find((p) => p.id === String(fd.get("id"))) ?? store.presets[0];
  const id = `custom-${Date.now().toString(36)}`;
  store.presets.push({ ...src, id, name: `${src.name} (copy)`, from: undefined, to: undefined, yearly: false });
  await save(store);
  redirect(`/admin/website/designs?edit=${id}`);
}

export async function deleteDesign(fd: FormData) {
  await assertStaff();
  const store = await load();
  const id = String(fd.get("id"));
  if (store.presets.length <= 1) redirect("/admin/website/designs?msg=Keep at least one design.");
  store.presets = store.presets.filter((p) => p.id !== id);
  if (store.active === id) store.active = store.presets[0].id;
  await save(store);
  redirect("/admin/website/designs?msg=Design deleted.");
}
