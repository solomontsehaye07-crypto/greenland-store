import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase";

// Handles the link in the sign-in email.
// - token_hash links (our email templates) work on any device or browser.
// - code links (Supabase's default templates) only work in the browser that asked for the email.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  const code = url.searchParams.get("code");
  const sb = await supabaseServer();

  let error: string | null = null;
  if (tokenHash) {
    const { error: e } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    error = e?.message ?? null;
  } else if (code) {
    const { error: e } = await sb.auth.exchangeCodeForSession(code);
    error = e?.message ?? null;
  } else {
    error = url.searchParams.get("error_description") ?? "The sign-in link is incomplete.";
  }

  if (error) {
    const back = new URL("/admin/login", url);
    back.searchParams.set("error", "That sign-in link didn't work or has expired. Request a new one below.");
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(new URL("/admin", url));
}
