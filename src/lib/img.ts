/**
 * Resized product photos. The originals on the Selldone CDN are large; wsrv.nl (free, cached image
 * proxy) returns them at the size a card needs, as WebP/AVIF when the browser supports it. Local or
 * already-small images are passed through unchanged.
 */
export function img(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!/^https?:\/\//.test(url) || /wsrv\.nl|images\.unsplash\.com/.test(url)) return url.includes("images.unsplash.com") ? unsplash(url, width) : url;
  // Open Food/Beauty Facts photos are packshots of any shape: show the whole pack on white instead of cropping it.
  const fit = openFactsCredit(url) ? "contain&cbg=ffffff" : "cover";
  return `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=${width}&h=${width}&fit=${fit}&q=78&output=webp`;
}

/** Photos from Open Food Facts / Open Beauty Facts are CC BY-SA and need a visible credit. */
export function openFactsCredit(url: string | null | undefined): { name: string; href: string } | null {
  const m = url?.match(/^https:\/\/images\.(openfoodfacts|openbeautyfacts)\.org\/images\/products\/([\d/]+)\//);
  if (!m) return null;
  const site = m[1] === "openfoodfacts" ? "Open Food Facts" : "Open Beauty Facts";
  const code = m[2].replace(/\//g, "");
  return { name: site, href: `https://world.${m[1]}.org/product/${code}` };
}

/** srcset for 1x/2x screens. */
export function imgSet(url: string | null | undefined, width: number) {
  return url ? `${img(url, width)} 1x, ${img(url, width * 2)} 2x` : undefined;
}

function unsplash(url: string, width: number) {
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "crop");
  if (!u.searchParams.get("q")) u.searchParams.set("q", "72");
  return u.toString();
}
