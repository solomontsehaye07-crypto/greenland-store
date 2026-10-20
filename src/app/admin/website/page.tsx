import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SECTION_DEFS, sectionDef } from "@/lib/sections";
import { addSection, deleteSection, moveSection, saveSection, toggleSection } from "./actions";
import { ConfirmButton, SubmitButton } from "@/components/admin/website/confirm-button";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { PageHead, SidePanel } from "@/components/admin/ui";
import { categoryOptions } from "./categories";

export const dynamic = "force-dynamic";

type Row = { id: number; position: number; type: string; enabled: boolean; data: Record<string, unknown> };

function preview(s: Row): string {
  const d = s.data ?? {};
  const pick = (v: unknown) => (v && typeof v === "object" ? ((v as { de?: string; en?: string }).de || (v as { en?: string }).en || "") : typeof v === "string" ? v : "");
  const t = pick(d.title);
  if (t) return t;
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  if (items.length) {
    const first = pick(items[0].text ?? items[0].title ?? items[0].label ?? items[0].q);
    return `${items.length} ${items.length === 1 ? "item" : "items"}${first ? `: ${first}` : ""}`;
  }
  return "No title yet";
}

export default async function WebsiteHome({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string }> }) {
  await requireStaff();
  const { edit, add } = await searchParams;
  const { data } = await supabaseAdmin().from("home_sections").select("id, position, type, enabled, data").order("position").order("id");
  const rows = (data ?? []) as Row[];
  const editing = edit ? rows.find((r) => String(r.id) === edit) : undefined;
  const editDef = editing ? sectionDef(editing.type) : undefined;
  const categories = editDef?.fields.some((f) => f.kind === "category") ? await categoryOptions() : [];

  return (
    <div>
      <PageHead
        title="Home page"
        text="The blocks of the home page from top to bottom. Click a block to edit it on the right. Colours and seasonal looks are under Designs & seasons."
        actions={
          <>
            <Link href="/" target="_blank" className="btn btn-ghost text-sm">Open the shop</Link>
            <Link href="/admin/website?add=1" scroll={false} className="btn btn-primary text-sm">Add a section</Link>
          </>
        }
      />

      <ol className="divide-y divide-line rounded-2xl border border-line bg-white">
        {rows.length === 0 && <li className="p-5 text-sm text-muted">The home page is empty. Add a section to start.</li>}
        {rows.map((s, i) => {
          const def = sectionDef(s.type);
          return (
            <li key={s.id} className={`flex items-center gap-2 px-3 py-2.5 ${String(s.id) === edit ? "bg-forest/5" : ""}`}>
              <div className="flex flex-col">
                <form action={moveSection}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button disabled={i === 0} className="rounded px-2 text-sm leading-5 hover:bg-surface disabled:opacity-25" aria-label={`Move ${def?.label ?? s.type} up`}>↑</button>
                </form>
                <form action={moveSection}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button disabled={i === rows.length - 1} className="rounded px-2 text-sm leading-5 hover:bg-surface disabled:opacity-25" aria-label={`Move ${def?.label ?? s.type} down`}>↓</button>
                </form>
              </div>
              <Link href={`/admin/website?edit=${s.id}`} scroll={false} className={`min-w-0 flex-1 rounded-lg px-2 py-1 hover:bg-surface ${s.enabled ? "" : "opacity-55"}`}>
                <span className="block truncate text-sm font-medium">{preview(s)}</span>
                <span className="block text-xs text-muted">{def?.label ?? s.type}{!s.enabled && " · hidden"}</span>
              </Link>
              <form action={toggleSection}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="enabled" value={String(!s.enabled)} />
                <SubmitButton className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface">{s.enabled ? "Hide" : "Show"}</SubmitButton>
              </form>
              <form action={deleteSection}>
                <input type="hidden" name="id" value={s.id} />
                <ConfirmButton />
              </form>
            </li>
          );
        })}
      </ol>

      {editing && editDef && (
        <SidePanel title={editDef.label} subtitle={editDef.description} closeHref="/admin/website" wide>
          {!editing.enabled && <p className="mb-4 rounded-xl bg-saffron/15 px-4 py-3 text-sm">This section is hidden on the shop. Choose Show in the list when it is ready.</p>}
          <FieldEditor key={editing.id} fields={editDef.fields} initial={{ ...editDef.defaults, ...(editing.data ?? {}) }} action={saveSection.bind(null, editing.id)} categories={categories} />
        </SidePanel>
      )}

      {add && (
        <SidePanel title="Add a section" subtitle="New sections start hidden at the bottom, so you can fill them in first." closeHref="/admin/website">
          <ul className="space-y-2">
            {SECTION_DEFS.map((d) => (
              <li key={d.type}>
                <form action={addSection}>
                  <input type="hidden" name="type" value={d.type} />
                  <button className="w-full rounded-xl border border-line bg-white p-4 text-left hover:border-forest">
                    <span className="block text-sm font-semibold">{d.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{d.description}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </SidePanel>
      )}
    </div>
  );
}
