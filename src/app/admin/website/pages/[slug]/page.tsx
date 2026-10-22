import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { deletePage } from "../../actions";
import { ConfirmButton } from "@/components/admin/website/confirm-button";
import { PageForm, type PageRow } from "./page-form";
import { LEGAL_SLUGS, pageHref } from "../slugs";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await params;
  const { data } = await supabaseAdmin().from("pages").select("slug, title, body, published, show_in_footer, sort, image").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const p = data as PageRow;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/website/pages" className="text-sm text-muted underline">Back to pages</Link>
          <h2 className="mt-2 text-2xl font-bold">{p.title?.de || p.title?.en || p.slug}</h2>
          <p className="mt-1 text-sm text-muted">
            Shown at {pageHref(p.slug)}
            {LEGAL_SLUGS.includes(p.slug) && ", in place of the built-in legal template"}.
          </p>
        </div>
        <form action={deletePage}>
          <input type="hidden" name="slug" value={p.slug} />
          <ConfirmButton label="Delete page" confirmLabel="Really delete this page?" />
        </form>
      </div>
      <PageForm page={p} />
    </div>
  );
}
