import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "./supabase";
import { siteUrl } from "./site";
import { welcomeCouponFor } from "./coupons";

export type CustomerProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: { street?: string; postal?: string; city?: string; country?: string } | null;
  marketing: boolean;
  role: string;
};

/** The signed-in shopper (any role), or null. */
export async function currentCustomer(): Promise<CustomerProfile | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabaseAdmin().from("profiles").select("full_name, phone, address, marketing, role").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email ?? "", full_name: p?.full_name ?? null, phone: p?.phone ?? null, address: (p?.address as CustomerProfile["address"]) ?? null, marketing: !!p?.marketing, role: p?.role ?? "customer" };
}

export const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/** Makes sure an auth user exists for this email (customers sign up by simply asking for a code). */
export async function ensureCustomerUser(email: string, fullName?: string) {
  const admin = supabaseAdmin();
  const mail = email.trim().toLowerCase();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", mail).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.auth.admin.createUser({ email: mail, email_confirm: true, user_metadata: { full_name: fullName ?? "" } });
  if (error) {
    // already registered under auth but the profile has no email yet (older accounts)
    if (/already|exists/i.test(error.message)) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = list?.users.find((x) => x.email?.toLowerCase() === mail);
      if (u) {
        await admin.from("profiles").update({ email: mail }).eq("id", u.id);
        return u.id;
      }
    }
    throw new Error(error.message);
  }
  return data.user.id;
}

/** Sends the 6-digit sign-in code (also usable as a link) to a shopper. */
export async function sendCustomerCode(email: string) {
  const mail = email.trim().toLowerCase();
  await ensureCustomerUser(mail);
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth;
  const { error } = await auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/account/confirm` } });
  if (error) {
    if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) throw new Error("Please wait a moment before requesting another code.");
    throw new Error("The code could not be sent right now. Please try again in a few minutes.");
  }
}

/** After the first sign-in: attach earlier guest orders with this email and make sure the welcome code exists. */
export async function afterCustomerSignIn(userId: string, email: string) {
  const admin = supabaseAdmin();
  const mail = email.trim().toLowerCase();
  await admin.from("orders").update({ customer_id: userId }).ilike("email", mail).is("customer_id", null);
  await admin.from("profiles").update({ email: mail }).eq("id", userId).is("email", null);
  const { data: p } = await admin.from("profiles").select("welcome_code, role").eq("id", userId).maybeSingle();
  if (p && p.role === "customer" && !p.welcome_code) {
    const { code } = await welcomeCouponFor(mail);
    await admin.from("profiles").update({ welcome_code: code }).eq("id", userId);
  }
}
