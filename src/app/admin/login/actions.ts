"use server";

import { redirect } from "next/navigation";

/** Only same-site paths are allowed as the page to open after sign-in. */
function safeNext(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/admin";
}
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";
import { waNumber } from "@/lib/notify";

export type LoginState = null | { step?: "code"; channel?: "email" | "sms"; target?: string; ok?: string; error?: string };

/** German numbers like 0152 123… become +49152123…; numbers with + or 00 keep their country code. */
const phoneE164 = (raw: string) => `+${waNumber(raw)}`;

const friendly = (status: number | undefined, msg: string) => {
  if (status === 429 || /rate limit|too many/i.test(msg)) return "Too many codes in a short time. Please wait a few minutes and try again.";
  if (/signups not allowed|user not found|not allowed for otp/i.test(msg)) return "This email or phone number is not registered for the admin. Ask the owner to add you under Team & roles.";
  if (/phone provider|sms|twilio|messagebird|vonage/i.test(msg)) return "Sending codes by SMS is not set up yet. Use email, or ask the owner to connect an SMS provider in Supabase.";
  return msg;
};

/** Step 1: send a one-time code by email or SMS. Only existing team members can receive one. */
export async function sendCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const channel = fd.get("channel") === "sms" ? "sms" : "email";
  const raw = String(fd.get("target") ?? "").trim();
  if (channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) return { error: "Please enter your email address." };
  if (channel === "sms" && raw.replace(/\D/g, "").length < 7) return { error: "Please enter your mobile number." };
  const target = channel === "email" ? raw.toLowerCase() : phoneE164(raw);

  // codes go out with the implicit flow, so the link in the email (if the template still has one) also works on any device
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth;
  const { error } =
    channel === "email"
      ? await auth.signInWithOtp({ email: target, options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/admin/auth/confirm` } })
      : await auth.signInWithOtp({ phone: target, options: { shouldCreateUser: false } });
  if (error) return { error: friendly(error.status, error.message), channel, target: raw };
  return {
    step: "code",
    channel,
    target,
    ok: channel === "email" ? `We sent a code to ${target}. It is valid for a few minutes.` : `We sent a code by SMS to ${target}.`,
  };
}

/** Step 2: check the code; on success the session cookie is set and the admin opens. */
export async function verifyCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const channel = fd.get("channel") === "sms" ? "sms" : "email";
  const target = String(fd.get("target") ?? "");
  const token = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", channel, target, error: "Enter the code from the message." };
  const sb = await supabaseServer();
  const { data, error } =
    channel === "email" ? await sb.auth.verifyOtp({ email: target, token, type: "email" }) : await sb.auth.verifyOtp({ phone: target, token, type: "sms" });
  if (error || !data.user) return { step: "code", channel, target, error: /expired|invalid/i.test(error?.message ?? "") ? "That code is wrong or has expired. Check it or request a new one." : error?.message ?? "Sign-in failed." };
  const { data: profile } = await supabaseAdmin().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || !["staff", "manager", "admin"].includes(profile.role)) {
    await sb.auth.signOut();
    return { error: "This account has no access to the admin." };
  }
  redirect(profile.role === "staff" ? "/admin" : safeNext(fd.get("next")));
}

/** Optional: sign in with a password instead of a code. */
export async function passwordSignIn(_: LoginState, fd: FormData): Promise<LoginState> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get("email") ?? "").trim().toLowerCase(), password: String(fd.get("password") ?? "") });
  if (error) return { error: "Wrong email or password. You can also sign in with a code instead." };
  redirect(safeNext(fd.get("next")));
}
