import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_FIELDS } from "@/lib/sections";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { saveSite } from "../actions";
import { PageHead } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function SiteSettings() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.site").maybeSingle();
  return (
    <div className="space-y-5">
      <PageHead title="Shop details" text="Logos, contact details, opening hours, the top bar, footer text and what search engines show." />
      <FieldEditor fields={SITE_FIELDS} initial={(data?.value as Record<string, unknown>) ?? {}} action={saveSite} />
    </div>
  );
}
