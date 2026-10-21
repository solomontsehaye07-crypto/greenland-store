"use server";

import { redirect } from "next/navigation";
import { saveOfferFromSupplier } from "@/lib/purchasing";

const euro = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s|€|EUR/gi, "").replace(",", ".");
  if (!s) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
};

/** Supplier sends prices from the private link (no login; the long random link is the key). */
export async function submitOffer(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  if (!/^[a-f0-9]{32,64}$/.test(token)) redirect("/");
  const lines: { product_id: number; price: number | null; available: boolean; note: string }[] = [];
  for (const [k] of fd.entries()) {
    const m = k.match(/^pid_(\d+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    lines.push({ product_id: id, price: euro(fd.get(`price_${id}`)), available: fd.get(`na_${id}`) !== "on", note: String(fd.get(`note_${id}`) ?? "").trim() });
  }
  try {
    await saveOfferFromSupplier(token, lines.slice(0, 500), String(fd.get("note") ?? "").trim(), String(fd.get("by") ?? "").trim());
  } catch (e) {
    redirect(`/offer/${token}?err=${encodeURIComponent((e as Error).message)}`);
  }
  redirect(`/offer/${token}?done=1`);
}
