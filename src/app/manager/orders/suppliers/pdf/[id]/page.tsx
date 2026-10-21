import Link from "next/link";
import { BackButton } from "../../../../ui";
import { supabaseAdmin } from "@/lib/supabase";
import { PdfView } from "@/components/pdf-view";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// In-app PDF preview, so the Manager app never jumps to Safari / Chrome.
export default async function PdfPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const id = Number((await params).id);
  const { back } = await searchParams;
  const { data: po } = await supabaseAdmin().from("purchase_orders").select("number, request_kind, suppliers(name)").eq("id", id).single();
  const code = `${po?.request_kind === "quote" ? "PR" : "PO"}-${po?.number ?? id}`;
  const backTo = back && back.startsWith("/manager/") ? back : "/manager/orders/suppliers";
  return (
    <div className="pb-6">
      <div className="mb-3 flex items-center gap-2">
        <BackButton href={backTo} />
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold">{code}</h1>
          <p className="truncate text-xs text-muted" data-no-translate>{(po?.suppliers as unknown as { name: string } | null)?.name}</p>
        </div>
      </div>
      <PdfView poId={id} filename={`${code}.pdf`} />
    </div>
  );
}
