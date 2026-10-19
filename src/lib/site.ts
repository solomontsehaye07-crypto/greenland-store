// The shop's public address, read at request time (not baked in at build time), so the same build
// works on the workers.dev address and later on the real domain. Set SITE_URL in Cloudflare.
export function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
