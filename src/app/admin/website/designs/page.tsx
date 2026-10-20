import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { currentDesign, DESIGN_FIELDS, storeFrom, type Design } from "@/lib/designs";
import { FieldEditor } from "@/components/admin/website/field-editor";
import { ConfirmButton } from "@/components/admin/website/confirm-button";
import { Notice, PageHead, SidePanel } from "@/components/admin/ui";
import Link from "next/link";
import { deleteDesign, duplicateDesign, saveDesign, switchDesign } from "./actions";

export const dynamic = "force-dynamic";

const dm = (s?: string) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : "");

function Preview({ d }: { d: Design }) {
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ background: d.heroBg, color: d.heroText }}>
      {d.heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 1 - Math.min(Number(d.heroDim ?? 30), 80) / 100 }} />
      )}
      <div className="relative flex items-end justify-between gap-3 p-4">
        <div>
          <p className="display text-lg font-bold leading-tight">Der Geschmack<br />von Zuhause.</p>
          <span className="mt-3 inline-block rounded-full px-3 py-1 text-[0.6875rem] font-semibold" style={{ background: d.heroAccent, color: "#fff" }}>Zum Shop</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => <span key={i} className="h-7 w-7 rounded-md bg-white/90" />)}
        </div>
      </div>
      <div className="relative flex h-2.5">
        {[d.paper, d.sand, d.forest, d.saffron, d.terra, d.indigo].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
      </div>
    </div>
  );
}

export default async function Designs({ searchParams }: { searchParams: Promise<{ edit?: string; msg?: string }> }) {
  await requireStaff();
  const { edit, msg } = await searchParams;
  const { data } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.designs", "public.theme"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  const store = storeFrom(get("public.designs"), get("public.theme") as Record<string, string> | undefined);
  const { design: live, scheduled } = currentDesign(store);
  const editing = edit ? store.presets.find((p) => p.id === edit) : undefined;

  return (
    <div>
      <PageHead
        title="Designs & seasons"
        text="Complete looks for the shop: colours, the hero and a top-bar message. Switch one on with a click, or give it dates so it switches on by itself for a season or holiday and back afterwards."
      />
      <Notice msg={msg} />
      <p className="mb-5 rounded-xl border border-line bg-white px-4 py-3 text-sm">
        Live now: <b>{live.name}</b>
        {scheduled ? <span className="text-muted"> (switched on by its dates {dm(live.from)}–{dm(live.to)}; afterwards the shop goes back to {store.presets.find((p) => p.id === store.active)?.name})</span> : null}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {store.presets.map((d) => {
          const isLive = d.id === live.id;
          return (
            <li key={d.id} className={`flex flex-col rounded-2xl border bg-white p-3 ${isLive ? "border-forest ring-1 ring-forest" : "border-line"}`}>
              <Preview d={d} />
              <div className="flex flex-1 flex-col px-1 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold">{d.name}</h2>
                  {isLive && <span className="rounded-full bg-forest px-2 py-0.5 text-[0.625rem] font-semibold text-white">Live</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {d.from && d.to ? `Automatic ${dm(d.from)}–${dm(d.to)}${d.yearly ? " every year" : ` ${d.to.slice(0, 4)}`}` : "Only when switched on"}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                  {store.active !== d.id && (
                    <form action={switchDesign}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn btn-primary h-8 px-3 py-1 text-xs">Switch on</button>
                    </form>
                  )}
                  <Link href={`/admin/website/designs?edit=${d.id}`} scroll={false} className="btn btn-ghost h-8 px-3 py-1 text-xs">Edit</Link>
                  <form action={duplicateDesign}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface">Duplicate</button>
                  </form>
                  {store.presets.length > 1 && (
                    <form action={deleteDesign} className="ml-auto">
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton />
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <SidePanel title={editing.name} subtitle="Changes show on the shop as soon as you save, if this design is live." closeHref="/admin/website/designs" wide>
          <div className="mb-5"><Preview d={editing} /></div>
          <FieldEditor key={editing.id} fields={DESIGN_FIELDS} initial={editing as unknown as Record<string, unknown>} action={saveDesign.bind(null, editing.id)} />
        </SidePanel>
      )}
    </div>
  );
}
