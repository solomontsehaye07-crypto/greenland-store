import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MediaLibrary } from "./media-library";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireStaff();
  const st = supabaseAdmin().storage.from("site-media");
  const { data, error } = await st.list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  const files = (data ?? [])
    .filter((f) => f.id && !f.name.startsWith("."))
    .map((f) => ({ name: f.name, url: st.getPublicUrl(f.name).data.publicUrl, size: (f.metadata as { size?: number } | null)?.size ?? 0 }));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Media</h2>
        <p className="mt-1 text-sm text-muted">Photos for banners, tiles and stories. Images up to 8 MB; square or 4:5 photos look best in the arches.</p>
      </div>
      {error && <p className="rounded-xl bg-white p-4 text-sm text-danger">The media library could not be loaded: {error.message}</p>}
      <MediaLibrary files={files} />
    </div>
  );
}
