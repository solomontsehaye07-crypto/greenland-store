import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sectionDef } from "@/lib/sections";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { saveSection } from "../../actions";
import { categoryOptions } from "../../categories";

export const dynamic = "force-dynamic";

export default async function EditSection({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { data: s } = await supabaseAdmin().from("home_sections").select("id, type, enabled, data").eq("id", id).maybeSingle();
  if (!s) notFound();
  const def = sectionDef(s.type);
  if (!def) notFound();
  const categories = def.fields.some((f) => f.kind === "category") ? await categoryOptions() : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/website" className="text-sm text-muted underline">Back to all sections</Link>
        <h2 className="mt-2 text-2xl font-bold">{def.label}</h2>
        <p className="mt-1 text-sm text-muted">{def.description}{!s.enabled && " This section is hidden on the shop until you choose Show in the section list."}</p>
      </div>
      <FieldEditor fields={def.fields} initial={{ ...def.defaults, ...(s.data ?? {}) }} action={saveSection.bind(null, s.id)} categories={categories} />
    </div>
  );
}
