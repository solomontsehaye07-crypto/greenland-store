import { NextResponse } from "next/server";
import { receiptFor } from "@/lib/orders";

export const dynamic = "force-dynamic";

// The order id is an unguessable UUID, the same link the customer gets by email.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await receiptFor(id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Beleg-${r.number ?? r.order.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
