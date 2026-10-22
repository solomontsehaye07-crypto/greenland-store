import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/catalog";

// Suggestions for the search boxes while the customer types (only public, active products).
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const found = await searchProducts(q, 8);
  const items = found.map((p) => ({
    slug: p.slug,
    title: p.title,
    title_de: p.title_de,
    brand: p.brand,
    price: Number(p.price),
    compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    image_url: p.image_url,
    size_qty: p.size_qty,
    size_unit: p.size_unit,
    stock: p.stock,
  }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
