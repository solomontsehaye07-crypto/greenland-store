"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";

export type PortalLogin = null | { step?: "code"; email?: string; ok?: string; error?: string };

/** Step 1: a one-time code by email. Only accounts the shop owner added as Steuerberater can receive one. */
export async function sendPortalCode(_: PortalLogin, fd: FormData): Promise<PortalLogin> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  // only send codes to accounts that have portal access (no account creation from here)
  const { data: prof } = await supabaseAdmin().from("profiles").select("role").eq("email", email).maybeSingle();
  if (!prof || !["tax_advisor", "admin"].includes(prof.role)) return { error: "Für diese E-Mail-Adresse ist kein Zugang eingerichtet. Bitte wenden Sie sich an den Shop." };
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth;
  const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/steuerberater/login` } });
  if (error) return { error: /rate limit|too many/i.test(error.message) ? "Zu viele Codes in kurzer Zeit. Bitte warten Sie einige Minuten." : error.message };
  return { step: "code", email, ok: `Wir haben einen Anmeldecode an ${email} gesendet. Er ist einige Minuten gültig.` };
}

/** Step 2: check the code; tax advisors (and the owner) get into the portal, nobody else. */
export async function verifyPortalCode(_: PortalLogin, fd: FormData): Promise<PortalLogin> {
  const email = String(fd.get("email") ?? "");
  const token = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", email, error: "Bitte den Code aus der E-Mail eingeben." };
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", email, error: "Der Code ist falsch oder abgelaufen. Bitte prüfen oder neu anfordern." };
  const { data: profile } = await supabaseAdmin().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || !["tax_advisor", "admin"].includes(profile.role)) {
    await sb.auth.signOut();
    return { error: "Dieses Konto ist nicht für den Kanzlei-Zugang freigeschaltet." };
  }
  redirect("/steuerberater");
}

export async function portalSignOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/steuerberater/login");
}
