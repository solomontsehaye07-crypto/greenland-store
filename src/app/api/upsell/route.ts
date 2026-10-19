import { NextResponse } from "next/server";
import { getUpsell } from "@/lib/catalog";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  const products = await getUpsell(ids, 8);
  return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
