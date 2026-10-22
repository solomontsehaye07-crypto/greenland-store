import "server-only";
import { supabaseAdmin } from "./supabase";

// Distance from the shop to a customer's address, for "local delivery within X km".
// Addresses are looked up once with OpenStreetMap's Nominatim (free; fair-use limit of about one request a
// second) and remembered in public.geocode_cache. The distance is straight-line ("Luftlinie").

export type Point = { lat: number; lng: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function geocode(a: { street?: string; postal?: string; city?: string; country?: string }): Promise<Point | null> {
  const street = (a.street ?? "").trim().slice(0, 120);
  const postal = (a.postal ?? "").trim().slice(0, 12);
  const city = (a.city ?? "").trim().slice(0, 80);
  if (!postal && !city) return null;
  const key = norm(`${a.country ?? "DE"}|${postal}|${city}|${street}`);
  const sb = supabaseAdmin();
  const { data: hit } = await sb.from("geocode_cache").select("lat, lng, found").eq("key", key).maybeSingle();
  if (hit) return hit.found ? { lat: hit.lat, lng: hit.lng } : null;
  const q = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: (a.country ?? "DE").toLowerCase() });
  if (street) q.set("street", street);
  if (postal) q.set("postalcode", postal);
  if (city) q.set("city", city);
  let point: Point | null = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": "GreenlandAfroAsiaStore/1.0 (+https://greenland-afroasia.de)", "Accept-Language": "de" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { lat: string; lon: string }[];
    if (j[0]) point = { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  } catch {
    return null; // lookup service unreachable: not cached, the next try asks again
  }
  await sb.from("geocode_cache").upsert({ key, lat: point?.lat ?? null, lng: point?.lng ?? null, found: !!point }, { onConflict: "key" });
  return point;
}

export function kmBetween(a: Point, b: Point) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The shop's own position, from the address under Admin → Account & receipts. */
export async function shopPoint(): Promise<Point | null> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.store").maybeSingle();
  const s = (data?.value ?? {}) as { street?: string; postal?: string; city?: string };
  // a placeholder street ("[Street] 58A") would find nothing; the postcode area is the next best guess
  const street = s.street && !/[[\]]/.test(s.street) ? s.street : "";
  return (await geocode({ street, postal: s.postal, city: s.city })) ?? (street ? geocode({ postal: s.postal, city: s.city }) : null);
}

/** Kilometres (one decimal) from the shop to an address; null when either can't be found. */
export async function distanceFromShop(a: { street?: string; postal?: string; city?: string; country?: string }): Promise<number | null> {
  const [shop, to] = await Promise.all([shopPoint(), geocode(a)]);
  if (!shop || !to) return null;
  return Math.round(kmBetween(shop, to) * 10) / 10;
}
