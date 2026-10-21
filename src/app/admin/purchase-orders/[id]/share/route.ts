import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { poPdfData, poShareText } from "@/lib/purchasing";

export const dynamic = "force-dynamic";

/** Data for building the PDF on the device, plus the message text for WhatsApp. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertStaff();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "Not signed in" ? "You are signed out – please log in again." : "Staff only" }, { status: 401 });
  }
  const id = Number((await params).id);
  const audience = new URL(req.url).searchParams.get("audience") === "other" ? "other" : "supplier";
  try {
    const [input, text] = await Promise.all([poPdfData(id), poShareText(id, audience)]);
    return NextResponse.json({ input, ...text }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
