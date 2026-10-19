import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Public Supabase project values (safe to ship to browsers). Inlined at build time so the
// Cloudflare build works without extra build variables; override them via the environment if needed.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://prtstuzxigbntxoaoqkm.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_uQSqk18PnC-dFanVRCMN7A_VADZW3mx",
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
