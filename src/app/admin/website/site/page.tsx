import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_FIELDS } from "@/lib/sections";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { saveSite } from "../actions";

export const dynamic = "force-dynamic";

export default async function SiteSettings() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.site").maybeSingle();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Site settings</h2>
        <p className="mt-1 text-sm text-muted">Logo, contact details, the top bar, footer text and what search engines show.</p>
      </div>
      <FieldEditor fields={SITE_FIELDS} initial={(data?.value as Record<string, unknown>) ?? {}} action={saveSite} />
    </div>
  );
}
