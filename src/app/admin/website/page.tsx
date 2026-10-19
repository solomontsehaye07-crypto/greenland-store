import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SECTION_DEFS, sectionDef } from "@/lib/sections";
import { addSection, deleteSection, moveSection, toggleSection } from "./actions";
import { ConfirmButton, SubmitButton } from "@/components/admin/website/confirm-button";

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

export default async function WebsiteHome() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("home_sections").select("id, position, type, enabled, data").order("position").order("id");
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">Home page sections</h2>
        <p className="mt-1 text-sm text-muted">The home page shows these blocks from top to bottom. Hidden sections stay here but don’t appear on the shop.</p>
        {rows.length === 0 && <p className="mt-6 rounded-xl bg-surface p-4 text-sm">The home page is empty. Add a section below to start.</p>}
        <ol className="mt-5 divide-y divide-line">
          {rows.map((s, i) => {
            const def = sectionDef(s.type);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
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
                <Link href={`/admin/website/section/${s.id}`} className={`min-w-0 flex-1 rounded-lg px-1 py-1 hover:bg-surface ${s.enabled ? "" : "opacity-55"}`}>
                  <span className="block text-sm font-semibold">{def?.label ?? s.type}{!s.enabled && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">Hidden</span>}</span>
                  <span className="block truncate text-sm text-muted">{preview(s)}</span>
                </Link>
                <div className="flex items-center gap-1">
                  <form action={toggleSection}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="enabled" value={String(!s.enabled)} />
                    <SubmitButton className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-surface">{s.enabled ? "Hide" : "Show"}</SubmitButton>
                  </form>
                  <Link href={`/admin/website/section/${s.id}`} className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-paper">Edit</Link>
                  <form action={deleteSection}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton />
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">Add a section</h2>
        <p className="mt-1 text-sm text-muted">New sections start hidden at the bottom, so you can fill them in before anyone sees them.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {SECTION_DEFS.map((d) => (
            <li key={d.type}>
              <form action={addSection} className="h-full">
                <input type="hidden" name="type" value={d.type} />
                <button className="h-full w-full rounded-xl border border-line p-4 text-left hover:border-forest hover:bg-paper">
                  <span className="block font-semibold">{d.label}</span>
                  <span className="mt-1 block text-sm text-muted">{d.description}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
