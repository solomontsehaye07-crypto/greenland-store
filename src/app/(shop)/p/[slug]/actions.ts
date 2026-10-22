"use server";

import { revalidatePath } from "next/cache";
import { currentCustomer } from "@/lib/customer";
import { supabaseAdmin } from "@/lib/supabase";
import { boughtProduct } from "@/lib/reviews";

export type ReviewState = { ok?: boolean; error?: string };

/** Saves (or updates) the signed-in customer's review of a product. */
export async function submitReview(_: ReviewState, fd: FormData): Promise<ReviewState> {
  const me = await currentCustomer();
  if (!me) return { error: "Bitte melde dich an, um eine Bewertung zu schreiben." };
  const productId = Number(fd.get("product_id"));
  const rating = Math.round(Number(fd.get("rating")));
  const body = String(fd.get("body") ?? "").trim().slice(0, 1200) || null;
  if (!productId || !(rating >= 1 && rating <= 5)) return { error: "Bitte wähle 1 bis 5 Sterne." };
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("products").select("slug, status").eq("id", productId).maybeSingle();
  if (!p || p.status !== "active") return { error: "Dieses Produkt gibt es nicht mehr." };
  // shown name: first name and initial of the last name, or the part of the email before the @
  const parts = (me.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const name = parts.length ? `${parts[0]}${parts[1] ? ` ${parts[parts.length - 1][0]}.` : ""}` : me.email.split("@")[0].slice(0, 20);
  const verified = await boughtProduct(me.id, productId);
  const { error } = await sb
    .from("product_reviews")
    .upsert({ product_id: productId, user_id: me.id, name, rating, body, verified, status: "published", created_at: new Date().toISOString() }, { onConflict: "product_id,user_id" });
  if (error) return { error: "Die Bewertung konnte nicht gespeichert werden. Bitte versuch es noch einmal." };
  revalidatePath(`/p/${p.slug}`);
  return { ok: true };
}
