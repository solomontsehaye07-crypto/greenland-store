import { NextResponse } from "next/server";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { invoiceDocData } from "@/lib/invoices";
import type { DocKind } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

/** Data for building an invoice / delivery note / reminder PDF on the device. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertStaff(MANAGER_ROLES);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "Not signed in" ? "You are signed out – please log in again." : (e as Error).message }, { status: 401 });
  }
  const k = new URL(req.url).searchParams.get("kind");
  const kind: DocKind = k === "delivery" || k === "reminder" ? k : "invoice";
  try {
    return NextResponse.json(await invoiceDocData(Number((await params).id), kind), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
