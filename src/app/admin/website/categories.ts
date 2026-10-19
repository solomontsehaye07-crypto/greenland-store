import { getCategories } from "@/lib/catalog";
import type { CategoryOption } from "@/components/admin/website/field-editor";

/** Categories as select options, grouped under their department. */
export async function categoryOptions(): Promise<CategoryOption[]> {
  const cats = await getCategories();
  const name = (c: { title: string; title_de: string | null }) => (c.title_de && c.title_de !== c.title ? `${c.title_de} (${c.title})` : c.title);
  const roots = cats.filter((c) => !c.parent_id);
  const out: CategoryOption[] = roots.map((r) => ({ slug: r.slug, label: `${name(r)}: whole department`, group: "Departments" }));
  for (const r of roots) for (const c of cats.filter((x) => x.parent_id === r.id)) out.push({ slug: c.slug, label: name(c), group: r.title_de || r.title });
  return out;
}
