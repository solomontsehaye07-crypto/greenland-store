"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const s = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const done = (id?: number) => {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/admin/recipes/${id}`);
};

export async function createRecipe(fd: FormData) {
  await assertStaff();
  const slug = s(fd.get("slug")).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Use lowercase letters, numbers and dashes for the address.");
  const titleDe = s(fd.get("title_de"));
  const { data, error } = await supabaseAdmin()
    .from("recipes")
    .insert({ slug, title: { de: titleDe, en: titleDe }, published: false })
    .select("id")
    .single();
  if (error) throw new Error(error.code === "23505" ? "A recipe with this address already exists." : error.message);
  done();
  redirect(`/admin/recipes/${data.id}`);
}

export async function saveRecipe(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const patch = {
    title: { de: s(fd.get("title_de")), en: s(fd.get("title_en")) },
    intro: { de: s(fd.get("intro_de")), en: s(fd.get("intro_en")) },
    image_url: s(fd.get("image_url")) || null,
    country: s(fd.get("country")) || null,
    published: fd.get("published") === "on",
    sort: Number(fd.get("sort")) || 0,
  };
  const { error } = await supabaseAdmin().from("recipes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  done(id);
}

export async function deleteRecipe(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const { error } = await supabaseAdmin().from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  done();
  redirect("/admin/recipes");
}

export async function addIngredient(fd: FormData) {
  await assertStaff();
  const recipe_id = Number(fd.get("recipe_id"));
  const product_id = Number(fd.get("product_id"));
  if (!recipe_id || !product_id) return;
  const { error } = await supabaseAdmin().from("recipe_items").upsert({ recipe_id, product_id, essential: true }, { onConflict: "recipe_id,product_id" });
  if (error) throw new Error(error.message);
  done(recipe_id);
}

export async function updateIngredient(fd: FormData) {
  await assertStaff();
  const recipe_id = Number(fd.get("recipe_id"));
  const product_id = Number(fd.get("product_id"));
  const { error } = await supabaseAdmin()
    .from("recipe_items")
    .update({ essential: fd.get("essential") === "on", note: { de: s(fd.get("note_de")), en: s(fd.get("note_en")) } })
    .match({ recipe_id, product_id });
  if (error) throw new Error(error.message);
  done(recipe_id);
}

export async function removeIngredient(fd: FormData) {
  await assertStaff();
  const recipe_id = Number(fd.get("recipe_id"));
  const product_id = Number(fd.get("product_id"));
  const { error } = await supabaseAdmin().from("recipe_items").delete().match({ recipe_id, product_id });
  if (error) throw new Error(error.message);
  done(recipe_id);
}
