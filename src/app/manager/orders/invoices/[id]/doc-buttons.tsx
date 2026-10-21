"use client";

import Link from "next/link";
import { WhatsAppPdf } from "@/components/whatsapp-pdf";
import type { DocKind } from "@/lib/invoice-pdf";
import { noteReminderSent } from "../actions";

/** One document (invoice, delivery note, reminder): look at it in the app, or send the PDF file. */
export function DocRow({ id, kind, label, sub, phone, primary = false }: { id: number; kind: DocKind; label: string; sub?: string; phone?: string | null; primary?: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-white p-3">
      <p className="text-base font-bold">{label}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href={`/manager/orders/invoices/${id}/pdf?kind=${kind}`} className="btn btn-ghost min-h-11 font-semibold">View</Link>
        <WhatsAppPdf
          source={{ type: "invoice", id, kind }}
          phone={phone}
          label="Send PDF"
          className={`btn ${primary ? "btn-primary" : "btn-ghost"} min-h-11 w-full font-semibold`}
          onShared={kind === "reminder" ? () => void noteReminderSent(id) : undefined}
        />
      </div>
    </div>
  );
}
