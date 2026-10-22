import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Videos are too big to pass through the website (Workers memory), so staff get a one-time signed upload
// address and the browser sends the file straight to storage (bucket "site-video", max 50 MB).

const BUCKET = "site-video";
const MAX = 50 * 1024 * 1024;
const TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { name?: string; type?: string; size?: number };
  const ext = TYPES[String(b.type ?? "")];
  if (!ext) return NextResponse.json({ error: "Please choose an MP4, WebM or MOV video." }, { status: 400 });
  if (!(Number(b.size) > 0) || Number(b.size) > MAX)
    return NextResponse.json({ error: "The video is larger than 50 MB. Shorten it or export it smaller (1080p, H.264) and try again." }, { status: 400 });
  const base = String(b.name ?? "video").replace(/\.[^.]+$/, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "video";
  const path = `${Date.now()}-${base}.${ext}`;
  const st = supabaseAdmin().storage.from(BUCKET);
  const { data, error } = await st.createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Upload could not be prepared." }, { status: 500 });
  return NextResponse.json({ bucket: BUCKET, path, token: data.token, url: st.getPublicUrl(path).data.publicUrl });
}
