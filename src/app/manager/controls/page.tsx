import { supabaseAdmin } from "@/lib/supabase";
import { currentDesign, storeFrom } from "@/lib/designs";
import { money } from "@/lib/format";
import { Msg, Section } from "../ui";
import { setPaused, setTopBar, toggleDelivery, useDesignNow } from "../actions";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Controls({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const { msg } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data: st }, { data: methods }] = await Promise.all([
    sb.from("settings").select("key, value").in("key", ["public.shop", "public.designs", "public.theme", "public.site"]),
    sb.from("shipping_methods").select("id, name, name_de, type, price, active").order("sort"),
  ]);
  const get = (k: string) => (st ?? []).find((r) => r.key === k)?.value;
  const shop = (get("public.shop") ?? {}) as { paused?: boolean; message?: { de?: string; en?: string } };
  const designs = storeFrom(get("public.designs"), get("public.theme") as Record<string, string> | undefined);
  const { design: live, scheduled } = currentDesign(designs);
  const top = ((get("public.site") as { announcements?: { text: { de?: string; en?: string } }[] } | undefined)?.announcements ?? [])[0]?.text ?? {};

  return (
    <div>
      <Msg msg={msg} />
      <Section title="Online orders">
        <form action={setPaused} className={`space-y-3 rounded-2xl border p-4 ${shop.paused ? "border-terra bg-terra/5" : "border-line bg-white"}`}>
          <p className="text-sm">{shop.paused ? <b className="text-terra">Paused – customers can browse but not order.</b> : <b className="text-forest">Open – customers can order.</b>}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="pm-de">Message while paused (German)</label><input id="pm-de" name="message_de" defaultValue={shop.message?.de ?? ""} placeholder="Wir sind im Urlaub bis 5.1." className="input" /></div>
            <div><label className="label" htmlFor="pm-en">Message while paused (English)</label><input id="pm-en" name="message_en" defaultValue={shop.message?.en ?? ""} placeholder="We are on holiday until 5 Jan." className="input" /></div>
          </div>
          <input type="hidden" name="paused" value={String(!shop.paused)} />
          <button className={`btn w-full ${shop.paused ? "btn-primary" : "btn-ghost"}`}>{shop.paused ? "Open online orders again" : "Pause online orders"}</button>
        </form>
      </Section>

      <Section title="Delivery & pickup">
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {(methods ?? []).filter((m) => m.type !== "dropship").map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm" data-no-translate>{m.name_de || m.name}</p>
                <p className="text-xs text-muted">{Number(m.price) ? money(m.price) : "free"}</p>
              </div>
              <form action={toggleDelivery}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="active" value={String(!m.active)} />
                <button aria-pressed={m.active} className={`relative h-7 w-12 rounded-full transition-colors ${m.active ? "bg-forest" : "bg-line"}`} aria-label={m.active ? "Switch off" : "Switch on"}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${m.active ? "left-6" : "left-1"}`} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Design of the shop">
        <p className="mb-2 text-xs text-muted">Live now: <b data-no-translate>{live.name}</b>{scheduled ? " (switched on by its dates)" : ""}</p>
        <div className="grid grid-cols-2 gap-2">
          {designs.presets.map((d) => (
            <form key={d.id} action={useDesignNow}>
              <input type="hidden" name="id" value={d.id} />
              <button className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left text-xs ${d.id === live.id ? "border-forest ring-1 ring-forest" : "border-line"} bg-white`}>
                <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: d.heroBg }} />
                <span className="truncate" data-no-translate>{d.name}</span>
              </button>
            </form>
          ))}
        </div>
      </Section>

      <Section title="Top-bar message">
        <form action={setTopBar} className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <div><label className="label" htmlFor="tb-de">German</label><input id="tb-de" name="de" defaultValue={top.de ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="tb-en">English</label><input id="tb-en" name="en" defaultValue={top.en ?? ""} className="input" /></div>
          <button className="btn btn-primary w-full">Save message</button>
        </form>
      </Section>
    </div>
  );
}
