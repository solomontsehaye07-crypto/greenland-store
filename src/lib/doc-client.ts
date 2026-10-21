"use client";

import { loadPoPdf } from "./po-pdf-client";
import { buildInvoicePdf, type DocKind, type InvoiceDocInput } from "./invoice-pdf";

/** Which document to build on the device. */
export type DocSource = { type: "po"; id: number; audience?: "supplier" | "other" } | { type: "invoice"; id: number; kind: DocKind };

let logo: Promise<string | null> | null = null;
function logoB64() {
  logo ??= fetch("/brand/greenland-logo-print.png")
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => {
      if (!b) return null;
      const u = new Uint8Array(b);
      let s = "";
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
      return btoa(s);
    })
    .catch(() => null);
  return logo;
}

export async function loadDoc(src: DocSource): Promise<{ bytes: Uint8Array; filename: string; message: string }> {
  if (src.type === "po") return loadPoPdf(src.id, src.audience ?? "supplier");
  const [res, lg] = await Promise.all([fetch(`/manager/orders/invoices/${src.id}/data?kind=${src.kind}`, { cache: "no-store", credentials: "same-origin" }), logoB64()]);
  const j = (await res.json().catch(() => null)) as { input?: InvoiceDocInput; filename?: string; message?: string; error?: string } | null;
  if (!res.ok || !j?.input) throw new Error(j?.error || `The server answered ${res.status}.`);
  const bytes = await buildInvoicePdf({ ...j.input, logoB64: lg }, src.kind);
  return { bytes, filename: j.filename ?? "Rechnung.pdf", message: j.message ?? "" };
}
