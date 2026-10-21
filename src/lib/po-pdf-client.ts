"use client";

import { buildPurchaseOrderPdf, type PoPdfInput } from "./po-pdf";

/** Fetches the request's data and builds the PDF right here on the device. */
export async function loadPoPdf(poId: number, audience: "supplier" | "other" = "supplier") {
  const res = await fetch(`/admin/purchase-orders/${poId}/share?audience=${audience}`, { cache: "no-store", credentials: "same-origin" });
  const j = (await res.json().catch(() => null)) as { input?: PoPdfInput; message?: string; filename?: string; error?: string } | null;
  if (!res.ok || !j?.input) throw new Error(j?.error || `The server answered ${res.status}.`);
  const bytes = await buildPurchaseOrderPdf(j.input);
  return { bytes, message: j.message ?? "", filename: j.filename ?? `PO-${poId}.pdf` };
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
