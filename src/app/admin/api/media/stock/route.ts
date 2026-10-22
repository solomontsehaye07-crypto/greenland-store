import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { trackDownload } from "@/lib/stock-photos";

/** Called when a free photo is picked: Unsplash counts it as a download (required by their API rules). */
export async function POST(req: Request) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const { dl } = (await req.json().catch(() => ({}))) as { dl?: string };
  if (dl) await trackDownload(dl);
  return NextResponse.json({ ok: true });
}
