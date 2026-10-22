import { NextResponse } from "next/server";
import { distanceFromShop } from "@/lib/geo";

// Checkout asks here how far the delivery address is from the shop (for local delivery within X km).
// Small per-visitor limit so nobody can use it to hammer the address lookup service.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "?";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 15) return NextResponse.json({ km: null, error: "Too many requests" }, { status: 429 });
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();
  const b = (await req.json().catch(() => ({}))) as { street?: string; postal?: string; city?: string; country?: string };
  const km = await distanceFromShop({ street: String(b.street ?? ""), postal: String(b.postal ?? ""), city: String(b.city ?? ""), country: String(b.country ?? "DE").slice(0, 2) });
  return NextResponse.json({ km });
}
