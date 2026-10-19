"use server";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function setLang(lang: "de" | "en") {
  (await cookies()).set("lang", lang === "en" ? "en" : "de", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function subscribe(_: unknown, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const lang = fd.get("lang") === "en" ? "en" : "de";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: lang === "en" ? "Please enter a valid email address." : "Bitte gib eine gültige E-Mail-Adresse ein." };
  // honeypot against bots
  if (String(fd.get("company") ?? "")) return { ok: true };
  await supabaseAdmin().from("subscribers").upsert({ email, lang, source: "home" }, { onConflict: "email", ignoreDuplicates: true });
  return { ok: true };
}
