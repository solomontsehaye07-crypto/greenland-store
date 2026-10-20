import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { poPdfBytes } from "@/lib/purchasing";

export const dynamic = "force-dynamic";

/** Live PDF of a refill request (for the preview), or ?file=<path> for an archived, sent version. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const id = Number((await params).id);
  const file = new URL(req.url).searchParams.get("file");
  let bytes: Uint8Array;
  let name = `refill-${id}.pdf`;
  if (file) {
    if (!/^purchase-orders\/[A-Za-z0-9._-]+\.pdf$/.test(file)) return NextResponse.json({ error: "Bad file" }, { status: 400 });
    const { data, error } = await supabaseAdmin().storage.from("documents").download(file);
    if (error || !data) return NextResponse.json({ error: "File not found" }, { status: 404 });
    bytes = new Uint8Array(await data.arrayBuffer());
    name = file.split("/").pop()!;
  } else {
    bytes = await poPdfBytes(id);
  }
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
