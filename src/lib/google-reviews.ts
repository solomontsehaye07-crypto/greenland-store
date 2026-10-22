import "server-only";
import { supabaseAdmin } from "./supabase";
import { decryptJson } from "./commerce";

// Google reviews for the home page, read from the Places API (New).
//   private.google        – { iv, data }: the API key, encrypted (entered by the owner in the admin)
//   public.google_reviews – place id, the last answer from Google and when it was fetched
// The shop asks Google at most every REFRESH_HOURS; visitors always get the saved copy.

export type GReview = { author: string; authorUrl: string | null; rating: number; text: string; when: string; time: string | null };
export type GoogleReviews = { placeId: string | null; name: string | null; rating: number | null; count: number | null; url: string | null; reviews: GReview[]; fetchedAt: string | null; error?: string | null; minRating: number };

const REFRESH_HOURS = 12;
const EMPTY: GoogleReviews = { placeId: null, name: null, rating: null, count: null, url: null, reviews: [], fetchedAt: null, minRating: 4 };

export async function getGoogleKey(): Promise<string | null> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.google").maybeSingle();
  return (await decryptJson<{ apiKey?: string }>(data?.value))?.apiKey || null;
}

async function readCache(): Promise<GoogleReviews> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.google_reviews").maybeSingle();
  return { ...EMPTY, ...((data?.value ?? {}) as Partial<GoogleReviews>) };
}

async function writeCache(v: GoogleReviews) {
  await supabaseAdmin().from("settings").upsert({ key: "public.google_reviews", value: v }, { onConflict: "key" });
}

type PlaceAnswer = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: { rating?: number; text?: { text?: string }; originalText?: { text?: string }; relativePublishTimeDescription?: string; publishTime?: string; authorAttribution?: { displayName?: string; uri?: string } }[];
};

/** Asks Google now and saves the answer. Returns the saved copy (with `error` set when Google refused). */
export async function refreshGoogleReviews(lang: "de" | "en" = "de"): Promise<GoogleReviews> {
  const cache = await readCache();
  const key = await getGoogleKey();
  if (!cache.placeId || !key) return cache;
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(cache.placeId)}?languageCode=${lang}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,rating,userRatingCount,googleMapsUri,reviews" },
      signal: AbortSignal.timeout(4000),
    });
    const j = (await r.json()) as PlaceAnswer & { error?: { message?: string } };
    if (!r.ok) throw new Error(j.error?.message || `Google answered ${r.status}`);
    const next: GoogleReviews = {
      ...cache,
      name: j.displayName?.text ?? cache.name,
      rating: j.rating ?? null,
      count: j.userRatingCount ?? null,
      url: j.googleMapsUri ?? null,
      reviews: (j.reviews ?? [])
        .map((x) => ({
          author: x.authorAttribution?.displayName ?? "Google",
          authorUrl: x.authorAttribution?.uri ?? null,
          rating: Number(x.rating ?? 0),
          text: (x.text?.text || x.originalText?.text || "").trim(),
          when: x.relativePublishTimeDescription ?? "",
          time: x.publishTime ?? null,
        }))
        .filter((x) => x.rating > 0),
      fetchedAt: new Date().toISOString(),
      error: null,
    };
    await writeCache(next);
    return next;
  } catch (e) {
    // keep showing the last good copy; remember the error for the admin page, and wait before trying again
    const next = { ...cache, fetchedAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
    await writeCache(next);
    return next;
  }
}

/** For the home page: the saved copy, refreshed first when it is older than REFRESH_HOURS. */
export async function getGoogleReviews(): Promise<GoogleReviews> {
  const cache = await readCache();
  if (!cache.placeId) return cache;
  const age = cache.fetchedAt ? Date.now() - new Date(cache.fetchedAt).getTime() : Infinity;
  if (age < REFRESH_HOURS * 3600 * 1000) return cache;
  return refreshGoogleReviews();
}

/** Finds a place by name and town ("Greenland Afro Asia Store Kaiserslautern"). */
export async function findPlace(query: string, key: string): Promise<{ id: string; name: string; address: string } | null> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress" },
    body: JSON.stringify({ textQuery: query, languageCode: "de" }),
    signal: AbortSignal.timeout(5000),
  });
  const j = (await r.json()) as { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message || `Google answered ${r.status}`);
  const p = j.places?.[0];
  return p ? { id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? "" } : null;
}

export async function saveGooglePlace(placeId: string, name: string | null, minRating: number) {
  const cache = await readCache();
  const changed = cache.placeId !== placeId;
  await writeCache({ ...(changed ? EMPTY : cache), placeId, name, minRating, fetchedAt: changed ? null : cache.fetchedAt });
}
