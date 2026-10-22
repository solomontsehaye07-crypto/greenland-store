import "server-only";
import { supabaseAdmin } from "./supabase";
import { decryptJson, encryptJson } from "./commerce";

// Free photo libraries for the media picker: Unsplash and Pexels, searched together.
// Keys live encrypted in settings.private.stock and are entered by the owner on Admin → Media.
// Both libraries ask apps to show the photo straight from their servers (hotlink) and to credit the
// photographer; Unsplash also wants a "download" ping when a photo is chosen (see trackDownload).

export type StockKeys = { unsplash?: string; pexels?: string };
export type StockPhoto = { name: string; url: string; thumb: string; label: string; provider: "unsplash" | "pexels"; credit: string; creditUrl: string; dl?: string };

export async function getStockKeys(): Promise<StockKeys> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.stock").maybeSingle();
  return (await decryptJson<StockKeys>(data?.value)) ?? {};
}

export async function saveStockKeys(next: StockKeys) {
  await supabaseAdmin().from("settings").upsert({ key: "private.stock", value: await encryptJson(next) }, { onConflict: "key" });
}

const APP = "greenland_afro_asia_store";

async function unsplash(key: string, q: string, page: number): Promise<{ items: StockPhoto[]; more: boolean }> {
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page + 1}&per_page=15&content_filter=high`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`Unsplash: ${r.status === 401 ? "the access key is not valid" : r.status === 403 ? "hourly limit reached, try again later" : `error ${r.status}`}`);
  const j = (await r.json()) as { total_pages: number; results: { id: string; alt_description?: string; urls: { raw: string; small: string }; links: { download_location: string }; user: { name: string; links: { html: string } } }[] };
  return {
    more: page + 1 < j.total_pages,
    items: j.results.map((p) => ({
      name: `unsplash-${p.id}`,
      url: `${p.urls.raw}&w=1800&q=75&auto=format&fit=crop`,
      thumb: p.urls.small,
      label: p.alt_description || q,
      provider: "unsplash",
      credit: p.user.name,
      creditUrl: `${p.user.links.html}?utm_source=${APP}&utm_medium=referral`,
      dl: p.links.download_location,
    })),
  };
}

async function pexels(key: string, q: string, page: number): Promise<{ items: StockPhoto[]; more: boolean }> {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page + 1}&per_page=15`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`Pexels: ${r.status === 401 ? "the API key is not valid" : r.status === 429 ? "hourly limit reached, try again later" : `error ${r.status}`}`);
  const j = (await r.json()) as { next_page?: string; photos: { id: number; alt?: string; photographer: string; photographer_url: string; src: { original: string; medium: string } }[] };
  return {
    more: !!j.next_page,
    items: j.photos.map((p) => ({
      name: `pexels-${p.id}`,
      url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1800`,
      thumb: p.src.medium,
      label: p.alt || q,
      provider: "pexels",
      credit: p.photographer,
      creditUrl: p.photographer_url,
    })),
  };
}

/** Searches every library that has a key, and mixes the results (one from each in turn). */
export async function searchStock(q: string, page: number): Promise<{ files: StockPhoto[]; more: boolean; errors: string[]; configured: boolean }> {
  const keys = await getStockKeys();
  const jobs: Promise<{ items: StockPhoto[]; more: boolean }>[] = [];
  if (keys.unsplash) jobs.push(unsplash(keys.unsplash, q, page));
  if (keys.pexels) jobs.push(pexels(keys.pexels, q, page));
  if (!jobs.length) return { files: [], more: false, errors: [], configured: false };
  const res = await Promise.allSettled(jobs);
  const lists = res.filter((r): r is PromiseFulfilledResult<{ items: StockPhoto[]; more: boolean }> => r.status === "fulfilled").map((r) => r.value);
  const errors = res.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message ?? r.reason));
  const files: StockPhoto[] = [];
  for (let i = 0; i < 15; i++) for (const l of lists) if (l.items[i]) files.push(l.items[i]);
  return { files, more: lists.some((l) => l.more), errors, configured: true };
}

/** Unsplash asks for this ping whenever a photo is actually used. Only their own URLs are accepted. */
export async function trackDownload(dl: string) {
  const keys = await getStockKeys();
  if (!keys.unsplash || !/^https:\/\/api\.unsplash\.com\/photos\/[\w-]+\/download/.test(dl)) return;
  await fetch(dl, { headers: { Authorization: `Client-ID ${keys.unsplash}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
}
