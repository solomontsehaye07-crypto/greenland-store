import "server-only";
import { supabaseAdmin } from "./supabase";

export type CouponCheck = { ok: true; code: string; percent_off: number } | { ok: false; reason: string };

const PAID = ["paid", "processing", "packed", "shipped", "ready_for_pickup", "delivered"];

/** Checks a discount code for this email and cart (does not use it up). */
export async function checkCoupon(rawCode: string, email: string, subtotal: number): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase().replace(/\s/g, "");
  if (!code) return { ok: false, reason: "Enter a code." };
  const sb = supabaseAdmin();
  const { data: c } = await sb.from("coupons").select("*").eq("code", code).maybeSingle();
  if (!c) return { ok: false, reason: "This code doesn't exist." };
  if (c.uses_left <= 0) return { ok: false, reason: "This code has already been used." };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { ok: false, reason: "This code has expired." };
  const mail = email.trim().toLowerCase();
  if (c.email && c.email !== mail) return { ok: false, reason: "This code belongs to another email address." };
  if (subtotal < Number(c.min_subtotal)) return { ok: false, reason: `This code works from ${Number(c.min_subtotal).toFixed(2).replace(".", ",")} € upwards.` };
  if (c.first_order_only && mail) {
    const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).ilike("email", mail).in("status", PAID);
    if ((count ?? 0) > 0) return { ok: false, reason: "This code is for your first order only." };
  }
  return { ok: true, code, percent_off: Number(c.percent_off) };
}

/** Uses one go of the code (called when the order is created). */
export async function consumeCoupon(code: string) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("coupons").select("uses_left").eq("code", code).single();
  if (data) await sb.from("coupons").update({ uses_left: Math.max(0, data.uses_left - 1) }).eq("code", code);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(prefix = "WELCOME") {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${[...b].map((x) => ALPHABET[x % ALPHABET.length]).join("")}`;
}

/** The 10 % welcome code for a new sign-up (one per email; returns the existing one if there is one). */
export async function welcomeCouponFor(email: string, percent = 10, validDays = 60) {
  const mail = email.trim().toLowerCase();
  const sb = supabaseAdmin();
  const { data: had } = await sb.from("coupons").select("code, uses_left, expires_at").eq("email", mail).like("code", "WELCOME-%").maybeSingle();
  if (had) return { code: had.code as string, fresh: false };
  const code = makeCode();
  await sb.from("coupons").insert({ code, percent_off: percent, email: mail, first_order_only: true, uses_left: 1, expires_at: new Date(Date.now() + validDays * 86400000).toISOString(), note: "welcome" });
  return { code, fresh: true };
}
