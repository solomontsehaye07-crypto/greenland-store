import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Product search for pickers in the admin (sections, offers). ?q=text or ?ids=1,2,3 */
export async function GET(req: Request) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");
  const ids = (u.searchParams.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  let query = supabaseAdmin().from("products").select("id, title, title_de, sku, image_url, price, compare_at_price, stock, status");
  if (ids.length) query = query.in("id", ids);
  else if (q) query = query.or(`title.ilike.%${q}%,title_de.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%,ean.eq.${q}`).order("title").limit(30);
  else query = query.order("featured", { ascending: false }).order("title").limit(30);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
