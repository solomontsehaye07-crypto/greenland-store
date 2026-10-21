import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Public Supabase project values (safe to ship to browsers). Inlined at build time so the
// Cloudflare build works without extra build variables; override them via the environment if needed.
// Security headers for every response. Scripts: Next.js needs inline scripts (no nonces on the edge build),
// so the CSP mainly stops foreign scripts, framing and plugins. Payments are redirects, not embedded.
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prtstuzxigbntxoaoqkm.supabase.co").replace(/\/$/, "");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://${SUPABASE.replace(/^https?:\/\//, "")}`,
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prtstuzxigbntxoaoqkm.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_uQSqk18PnC-dFanVRCMN7A_VADZW3mx",
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
