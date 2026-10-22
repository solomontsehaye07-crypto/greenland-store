import "server-only";
import { supabaseAdmin } from "./supabase";

export type Review = { id: number; name: string; rating: number; body: string | null; verified: boolean; created_at: string };
export type ReviewSummary = { avg: number; count: number; dist: number[]; items: Review[] };

/** Orders in these states count as "bought" for the verified-buyer badge. */
export const BOUGHT = ["paid", "processing", "packed", "shipped", "ready_for_pickup", "delivered"];

export async function getReviews(productId: number): Promise<ReviewSummary> {
  const { data } = await supabaseAdmin()
    .from("product_reviews")
    .select("id, name, rating, body, verified, created_at")
    .eq("product_id", productId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  const items = (data ?? []) as Review[];
  const dist = [0, 0, 0, 0, 0];
  for (const r of items) dist[r.rating - 1]++;
  const count = items.length;
  const avg = count ? Math.round((items.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return { avg, count, dist, items };
}

export async function boughtProduct(userId: string, productId: number) {
  const { data } = await supabaseAdmin()
    .from("order_items")
    .select("id, orders!inner(customer_id, status)")
    .eq("product_id", productId)
    .eq("orders.customer_id", userId)
    .in("orders.status", BOUGHT)
    .limit(1);
  return !!data?.length;
}

export async function myReview(userId: string, productId: number) {
  const { data } = await supabaseAdmin().from("product_reviews").select("rating, body").eq("product_id", productId).eq("user_id", userId).maybeSingle();
  return data as { rating: number; body: string | null } | null;
}
