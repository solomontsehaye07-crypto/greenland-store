import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NewPageForm } from "./new-page-form";
import { LEGAL_SLUGS, pageHref } from "./slugs";

export const dynamic = "force-dynamic";

type Row = { slug: string; title: { de?: string; en?: string }; published: boolean; show_in_footer: boolean; sort: number };

export default async function PagesList() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("pages").select("slug, title, published, show_in_footer, sort").order("sort").order("slug");
  const rows = (data ?? []) as Row[];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">Pages</h2>
        <p className="mt-1 text-sm text-muted">
          Info pages such as delivery or about us appear at /info/address. A page with the address {LEGAL_SLUGS.join(", ")} replaces the built-in legal template at /legal/address.
        </p>
        {rows.length === 0 ? (
          <p className="mt-5 rounded-xl bg-surface p-4 text-sm">No pages yet. Create the first one below.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Address</th><th>Status</th><th>In footer</th><th>Order</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.slug}>
                    <td className="font-semibold">{p.title?.de || p.title?.en || p.slug}</td>
                    <td><a href={pageHref(p.slug)} target="_blank" className="text-muted underline">{pageHref(p.slug)}</a></td>
                    <td>{p.published ? <span className="font-medium text-forest">Published</span> : <span className="text-muted">Draft</span>}</td>
                    <td>{p.show_in_footer ? "Yes" : "No"}</td>
                    <td>{p.sort}</td>
                    <td className="text-right"><Link href={`/admin/website/pages/${p.slug}`} className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-paper">Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <NewPageForm />
    </div>
  );
}
