import { getHomeSections } from "@/lib/content";
import { getLang } from "@/lib/i18n";
import { Sections } from "@/components/sections";

// Always rendered fresh, so edits in the website editor, prices and stock show immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [sections, lang] = await Promise.all([getHomeSections(), getLang()]);
  return (
    <div className="home">
      <Sections sections={sections} lang={lang} />
    </div>
  );
}
