import { NextResponse } from "next/server";
import { getRecipesForProducts } from "@/lib/recipes";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  const recipes = ids.length ? await getRecipesForProducts(ids) : [];
  return NextResponse.json({ recipes }, { headers: { "Cache-Control": "no-store" } });
}
