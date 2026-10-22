import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStaff, assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, PageHead } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

async function setStatus(fd: FormData) {
  "use server";
  await assertStaff();
  const id = Number(fd.get("id"));
  const status = fd.get("status") === "hidden" ? "hidden" : "published";
  const sb = supabaseAdmin();
  const { data } = await sb.from("product_reviews").update({ status }).eq("id", id).select("products(slug)").single();
  const slug = (data?.products as { slug?: string } | null)?.slug;
  if (slug) revalidatePath(`/p/${slug}`);
  revalidatePath("/admin/reviews");
}

type Row = { id: number; name: string; rating: number; body: string | null; verified: boolean; status: string; created_at: string; products: { title: string; title_de: string | null; slug: string } | null };

/** Customer reviews: everything is online right away; hide what should not be shown. */
export default async function Reviews() {
  await requireStaff();
  const { data } = await supabaseAdmin()
    .from("product_reviews")
    .select("id, name, rating, body, verified, status, created_at, products(title, title_de, slug)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <PageHead title="Reviews" text="Customers who are signed in can rate products; buyers get a “verified purchase” badge. New reviews are online right away – hide anything rude or off-topic." />
      <Card>
        {rows.length ? (
          <ul className="-mx-2 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-start gap-3 px-2 py-3 ${r.status === "hidden" ? "opacity-55" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="text-saffron">{"★".repeat(r.rating)}</span>
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>{" "}
                    <b data-no-translate>{r.name}</b>
                    {r.verified && <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-forest">verified</span>}
                    <span className="ml-2 text-xs text-muted">{new Date(r.created_at).toLocaleDateString("de-DE")}</span>
                  </p>
                  {r.products && <Link href={`/p/${r.products.slug}#bewertungen`} target="_blank" className="text-xs text-forest underline">{r.products.title_de || r.products.title}</Link>}
                  {r.body && <p className="mt-1 whitespace-pre-line text-sm text-muted" data-no-translate>{r.body}</p>}
                </div>
                <form action={setStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={r.status === "hidden" ? "published" : "hidden"} />
                  <button className="btn btn-ghost text-sm">{r.status === "hidden" ? "Show again" : "Hide"}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No reviews yet. They appear here as soon as customers rate products.</p>
        )}
      </Card>
    </div>
  );
}
