import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHead } from "@/components/admin/ui";
import { TranslationEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function Translations() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.admin_ti").maybeSingle();
  return (
    <div>
      <PageHead
        title="Translations"
        text="The Tigrinya texts of the admin screens. Correct any wording here; texts that are still in English while working in Tigrinya are collected under “Still in English” so you can add them. Customer emails, receipts, PDFs and reports always stay in English and German."
      />
      <TranslationEditor overrides={(data?.value as Record<string, string>) ?? {}} />
    </div>
  );
}
