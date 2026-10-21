import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { currentCustomer } from "@/lib/customer";

/** Cart lines for one of the signed-in customer's own earlier orders. */
export async function GET(req: Request) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("order") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("id, customer_id, order_items(product_id, qty)").eq("id", id).eq("customer_id", me.id).maybeSingle();
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = (o.order_items as { product_id: number | null; qty: number }[]).filter((i) => i.product_id);
  const { data: ps } = await sb.from("products").select("id, slug, sku, title, price, image_url, weight_g, is_frozen, age_restricted, stock, status").in("id", items.map((i) => i.product_id!));
  const lines = items.flatMap((i) => {
    const p = (ps ?? []).find((x) => x.id === i.product_id);
    if (!p || p.status !== "active" || p.stock <= 0) return [];
    return [{ id: p.id, slug: p.slug, sku: p.sku, title: p.title, price: Number(p.price), image_url: p.image_url, weight_g: p.weight_g ?? 0, is_frozen: !!p.is_frozen, age_restricted: !!p.age_restricted, qty: Math.min(i.qty, p.stock, 99) }];
  });
  return NextResponse.json({ lines, missing: items.length - lines.length }, { headers: { "Cache-Control": "no-store" } });
}
