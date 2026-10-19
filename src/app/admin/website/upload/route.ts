import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Image uploads for the website editor. A route handler (not a server action) so files up to 8 MB
// are accepted without raising the server-action body limit.

const BUCKET = "site-media";
const MAX = 8 * 1024 * 1024;

export const dynamic = "force-dynamic";

function cleanName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
  const ext = (dot > 0 ? name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${base}.${ext}`;
}

export async function GET() {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const st = supabaseAdmin().storage.from(BUCKET);
  const { data, error } = await st.list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const files = (data ?? [])
    .filter((f) => f.id && !f.name.startsWith("."))
    .map((f) => ({ name: f.name, url: st.getPublicUrl(f.name).data.publicUrl, size: (f.metadata as { size?: number } | null)?.size ?? null, created_at: f.created_at }));
  return NextResponse.json({ files });
}

export async function POST(req: Request) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }
  const st = supabaseAdmin().storage.from(BUCKET);
  const files: { name: string; url: string }[] = [];
  const errors: string[] = [];
  for (const f of fd.getAll("file")) {
    if (!(f instanceof File) || !f.size) continue;
    if (!f.type.startsWith("image/")) {
      errors.push(`${f.name}: only images can be uploaded.`);
      continue;
    }
    if (f.size > MAX) {
      errors.push(`${f.name}: larger than 8 MB. Make it smaller and try again.`);
      continue;
    }
    const name = cleanName(f.name);
    const { error } = await st.upload(name, await f.arrayBuffer(), { contentType: f.type, cacheControl: "31536000", upsert: false });
    if (error) errors.push(`${f.name}: ${error.message}`);
    else files.push({ name, url: st.getPublicUrl(name).data.publicUrl });
  }
  if (!files.length && !errors.length) errors.push("No files received.");
  return NextResponse.json({ files, errors }, { status: files.length ? 200 : 400 });
}
