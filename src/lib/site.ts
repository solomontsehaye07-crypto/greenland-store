// The shop's public address, read at request time (not baked in at build time), so the same build
// works on the workers.dev address and later on the real domain. Set SITE_URL in Cloudflare.
export function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Only a path on this site (no other host, no protocol tricks) – for "next"/"back" redirects after actions. */
export function safePath(v: unknown, fallback: string) {
  const s = String(v ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\")) return fallback;
  try {
    const u = new URL(s, "https://x.invalid");
    if (u.origin !== "https://x.invalid") return fallback;
    return u.pathname + u.search;
  } catch {
    return fallback;
  }
}

/** HTML-escapes text that goes into an email or page built from strings. */
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
