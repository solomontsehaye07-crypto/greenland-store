import { supabaseAdmin } from "@/lib/supabase";
import { PdfView } from "@/components/pdf-view";
import type { DocKind } from "@/lib/invoice-pdf";
import { BackButton } from "../../../../ui";

export const dynamic = "force-dynamic";

// Invoice, delivery note or reminder shown inside the app.
export default async function InvoicePdf({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const id = Number((await params).id);
  const k = (await searchParams).kind;
  const kind: DocKind = k === "delivery" || k === "reminder" ? k : "invoice";
  const { data: inv } = await supabaseAdmin().from("invoices").select("number, business_customers(name)").eq("id", id).single();
  const label = kind === "delivery" ? "Delivery note" : kind === "reminder" ? "Payment reminder" : "Invoice";
  return (
    <div className="pb-6">
      <div className="mb-3 flex items-center gap-3">
        <BackButton href={`/manager/orders/invoices/${id}`} />
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold">{label} {inv?.number ?? "(draft)"}</h1>
          <p className="truncate text-xs text-muted" data-no-translate>{(inv?.business_customers as unknown as { name: string } | null)?.name}</p>
        </div>
      </div>
      <PdfView source={{ type: "invoice", id, kind }} filename={`${label}-${inv?.number ?? id}.pdf`} />
    </div>
  );
}
