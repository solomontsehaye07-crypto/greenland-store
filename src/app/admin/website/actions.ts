"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_THEME, sectionDef } from "@/lib/sections";

export type FormState = { ok?: string; error?: string; at?: number } | null;

const BUCKET = "site-media";
const done = () => revalidatePath("/", "layout");

function parseData(fd: FormData): Record<string, unknown> {
  const raw = String(fd.get("data") ?? "");
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error("The form data could not be read. Reload the page and try again.");
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("The form data must be an object.");
  return v as Record<string, unknown>;
}

function fail(e: unknown): FormState {
  return { error: e instanceof Error ? e.message : "Saving failed. Try again." };
}

// ---------- home sections ----------

async function orderedSections() {
  const { data, error } = await supabaseAdmin().from("home_sections").select("id, position").order("position").order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addSection(fd: FormData) {
  await assertStaff();
  const type = String(fd.get("type") ?? "");
  const def = sectionDef(type);
  if (!def) throw new Error("Unknown section type");
  const rows = await orderedSections();
  const position = rows.length ? Math.max(...rows.map((r) => r.position)) + 10 : 10;
  const { data, error } = await supabaseAdmin()
    .from("home_sections")
    .insert({ type, position, enabled: false, data: def.defaults })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  done();
  redirect(`/admin/website?edit=${data.id}`);
}

export async function toggleSection(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const enabled = fd.get("enabled") === "true";
  const { error } = await supabaseAdmin().from("home_sections").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  done();
}

export async function moveSection(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const rows = await orderedSections();
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  const sb = supabaseAdmin();
  // Rewrite positions as 10, 20, 30 … so ties never block a move.
  await Promise.all(
    rows.map((r, k) => ((k + 1) * 10 !== r.position ? sb.from("home_sections").update({ position: (k + 1) * 10 }).eq("id", r.id) : null))
  );
  done();
}

export async function deleteSection(fd: FormData) {
  await assertStaff();
  const { error } = await supabaseAdmin().from("home_sections").delete().eq("id", Number(fd.get("id")));
  if (error) throw new Error(error.message);
  done();
}

export async function saveSection(id: number, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertStaff();
    const data = parseData(fd);
    const enabled = fd.get("enabled");
    const patch: Record<string, unknown> = { data };
    if (enabled !== null) patch.enabled = enabled === "true";
    const { error } = await supabaseAdmin().from("home_sections").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    done();
    return { ok: "Saved. The change is live on the shop.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

// ---------- settings ----------

async function upsertSetting(key: string, value: unknown) {
  const { error } = await supabaseAdmin().from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function saveSite(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertStaff();
    const data = parseData(fd);
    if (typeof data.whatsapp === "string") data.whatsapp = data.whatsapp.replace(/\D/g, "");
    await upsertSetting("public.site", data);
    done();
    return { ok: "Saved. The change is live on the shop.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTheme(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertStaff();
    const data = parseData(fd);
    const out: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(DEFAULT_THEME)) {
      const v = data[k];
      if (typeof d === "boolean") out[k] = v === undefined ? d : Boolean(v);
      else {
        if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`"${k}" must be a colour like #B5482A.`);
        out[k] = v.toUpperCase();
      }
    }
    await upsertSetting("public.theme", out);
    done();
    return { ok: "Saved. The new colours are live on the shop.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

// ---------- pages ----------

const SLUG = /^[a-z0-9-]+$/;

export async function createPage(_: FormState, fd: FormData): Promise<FormState> {
  await assertStaff();
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  const title = String(fd.get("title") ?? "").trim();
  if (!SLUG.test(slug)) return { error: "Use only lowercase letters, numbers and dashes for the address, e.g. rezepte." };
  const { data: exists } = await supabaseAdmin().from("pages").select("slug").eq("slug", slug).maybeSingle();
  if (exists) return { error: `A page with the address "${slug}" already exists.` };
  const { error } = await supabaseAdmin()
    .from("pages")
    .insert({ slug, title: { de: title || slug, en: "" }, body: { de: "", en: "" }, published: false, show_in_footer: false, sort: 99 });
  if (error) return { error: error.message };
  done();
  redirect(`/admin/website/pages/${slug}`);
}

export async function savePage(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertStaff();
    const s = (k: string) => String(fd.get(k) ?? "");
    const row = {
      title: { de: s("title_de").trim(), en: s("title_en").trim() },
      body: { de: s("body_de"), en: s("body_en") },
      published: fd.get("published") === "on",
      show_in_footer: fd.get("show_in_footer") === "on",
      sort: Number.isFinite(Number(s("sort"))) ? Math.round(Number(s("sort"))) : 0,
      image: /^(https:\/\/|\/)/.test(s("image").trim()) ? s("image").trim() : null,
    };
    if (!row.title.de && !row.title.en) throw new Error("Give the page a title in at least one language.");
    const { error } = await supabaseAdmin().from("pages").update(row).eq("slug", slug);
    if (error) throw new Error(error.message);
    done();
    return { ok: row.published ? "Saved. The page is live." : "Saved as a draft. Turn on Published to show it on the shop.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePage(fd: FormData) {
  await assertStaff();
  const { error } = await supabaseAdmin().from("pages").delete().eq("slug", String(fd.get("slug")));
  if (error) throw new Error(error.message);
  done();
  redirect("/admin/website/pages");
}

// ---------- media ----------

export async function deleteMedia(fd: FormData) {
  await assertStaff();
  const raw = String(fd.get("name") ?? "");
  const [bucket, name] = raw.includes("/") ? [raw.slice(0, raw.indexOf("/")), raw.slice(raw.indexOf("/") + 1)] : [BUCKET, raw];
  if (!name || name.includes("..") || !["site-media", "product-images"].includes(bucket)) throw new Error("Invalid file name");
  const { error } = await supabaseAdmin().storage.from(bucket).remove([name]);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/website/media");
}
