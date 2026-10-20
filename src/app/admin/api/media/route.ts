import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Everything the admin can pick an image from:
 *  - uploads: files in the site-media and product-images storage buckets
 *  - products: the photo of every product in the catalogue (searchable)
 */
export async function GET(req: Request) {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const u = new URL(req.url);
  const source = u.searchParams.get("source") ?? "uploads";
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Math.max(0, Number(u.searchParams.get("page") ?? 0));
  const sb = supabaseAdmin();

  if (source === "products") {
    const per = 60;
    let query = sb.from("products").select("id, title, title_de, sku, image_url, images", { count: "exact" }).not("image_url", "is", null).order("title");
    if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, "")}%,title_de.ilike.%${q.replace(/[%,()]/g, "")}%,sku.ilike.%${q.replace(/[%,()]/g, "")}%`);
    const { data, count, error } = await query.range(page * per, page * per + per - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const files: { name: string; url: string; label: string }[] = [];
    for (const p of data ?? []) {
      const urls = new Set<string>([p.image_url as string, ...((Array.isArray(p.images) ? p.images : []) as string[])].filter(Boolean));
      [...urls].forEach((url, i) => files.push({ name: `${p.sku}-${i}`, url, label: `${p.title_de || p.title}${i ? ` (${i + 1})` : ""}` }));
    }
    return NextResponse.json({ files, total: count ?? 0, more: (page + 1) * per < (count ?? 0) });
  }

  const files: { name: string; url: string; label: string; size?: number; created_at?: string; bucket: string }[] = [];
  for (const bucket of ["site-media", "product-images"]) {
    const st = sb.storage.from(bucket);
    const { data } = await st.list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    for (const f of data ?? []) {
      if (!f.id || f.name.startsWith(".")) continue;
      const label = f.name.replace(/^\d+-[a-z0-9]{4}-/, "");
      if (q && !label.toLowerCase().includes(q)) continue;
      files.push({ name: `${bucket}/${f.name}`, url: st.getPublicUrl(f.name).data.publicUrl, label, size: (f.metadata as { size?: number } | null)?.size, created_at: f.created_at ?? undefined, bucket });
    }
  }
  files.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return NextResponse.json({ files, total: files.length, more: false });
}
