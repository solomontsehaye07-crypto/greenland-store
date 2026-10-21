"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { afterCustomerSignIn, currentCustomer, ensureCustomerUser, sendCustomerCode, validEmail } from "@/lib/customer";
import { welcomeCouponFor } from "@/lib/coupons";
import { safePath } from "@/lib/site";

export type AccountState = null | { step?: "code"; email?: string; ok?: string; error?: string; code?: string };

/** Step 1: email → code. */
export async function requestCode(_: AccountState, fd: FormData): Promise<AccountState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!validEmail(email)) return { error: "Please enter a valid email address." };
  try {
    await sendCustomerCode(email);
  } catch (e) {
    return { error: (e as Error).message, email };
  }
  return { step: "code", email, ok: `We sent a 6-digit code to ${email}. It is valid for a few minutes.` };
}

/** Step 2: code → signed in. */
export async function confirmCode(_: AccountState, fd: FormData): Promise<AccountState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const token = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", email, error: "Enter the 6 digits from the email." };
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", email, error: "That code is wrong or has expired. Request a new one." };
  await afterCustomerSignIn(data.user.id, email);
  redirect(safePath(fd.get("next"), "/account"));
}

export async function signOutCustomer() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}

export async function saveCustomerDetails(fd: FormData) {
  const me = await currentCustomer();
  if (!me) redirect("/account");
  const t = (k: string) => String(fd.get(k) ?? "").trim().slice(0, 160);
  await supabaseAdmin()
    .from("profiles")
    .update({
      full_name: t("name") || null,
      phone: t("phone") || null,
      address: { street: t("street"), postal: t("postal").slice(0, 12), city: t("city"), country: (t("country") || "DE").toUpperCase().slice(0, 2) },
      marketing: fd.get("marketing") === "on",
    })
    .eq("id", me.id);
  revalidatePath("/account");
  redirect("/account?msg=saved");
}

/** Sign-up from the welcome pop-up: creates the account and shows the 10 % code at once. */
export async function joinWithEmail(_: AccountState, fd: FormData): Promise<AccountState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!validEmail(email)) return { error: "Please enter a valid email address." };
  // honeypot
  if (String(fd.get("website") ?? "")) return { ok: "Thanks!" };
  try {
    const id = await ensureCustomerUser(email);
    const { code } = await welcomeCouponFor(email);
    await supabaseAdmin().from("profiles").update({ welcome_code: code, marketing: true }).eq("id", id).is("welcome_code", null);
    await supabaseAdmin().from("subscribers").upsert({ email, lang: "de" }, { onConflict: "email", ignoreDuplicates: true }).then(() => null, () => null);
    return { ok: "done", code, email };
  } catch {
    return { error: "That didn't work right now. Please try again in a moment." };
  }
}
