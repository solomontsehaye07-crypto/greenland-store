import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { labelLink } from "@/lib/dhl";

/** Opens the stored DHL label PDF (short-lived signed link). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", _.url));
  }
  const { id } = await params;
  const url = await labelLink(id);
  if (!url) return new NextResponse("No label stored for this order.", { status: 404 });
  return NextResponse.redirect(url);
}
