import Link from "next/link";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { getPickupSettings, pickupSlots } from "@/lib/commerce";
import { Card, Notice, PageHead, SidePanel, Toggle } from "@/components/admin/ui";
import { savePickup, saveShippingMethod, toggleShippingMethod } from "../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  parcel: "Parcel (carrier)",
  frozen: "Frozen express",
  local: "Local delivery (own driver)",
  pickup: "Pickup in the shop",
  dropship: "Dropship (supplier ships)",
};
const CARRIERS: { name: string; url: string }[] = [
  { name: "DHL", url: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={tracking}" },
  { name: "DPD", url: "https://tracking.dpd.de/status/de_DE/parcel/{tracking}" },
  { name: "GLS", url: "https://gls-group.com/DE/de/paketverfolgung?match={tracking}" },
  { name: "Hermes", url: "https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#{tracking}" },
  { name: "UPS", url: "https://www.ups.com/track?tracknum={tracking}" },
  { name: "GO! Express", url: "https://www.general-overnight.com/deu_de/sendungsverfolgung.html?reference={tracking}" },
];
const DAYS: [string, string][] = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type M = Record<string, any>;

export default async function ShippingSettings({ searchParams }: { searchParams: Promise<{ edit?: string; pickup?: string; msg?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const { edit, pickup: editPickup, msg } = await searchParams;
  const { data } = await supabaseAdmin().from("shipping_methods").select("*").order("sort").order("id");
  const methods = (data ?? []) as M[];
  const p = await getPickupSettings();
  const preview = (await pickupSlots(p)).slice(0, 4);
  const editing: M | undefined = edit === "new" ? { type: "parcel", active: true, countries: ["DE"], price: 0, min_order: 0, sort: (methods.at(-1)?.sort ?? 0) + 10 } : methods.find((m) => String(m.id) === edit);

  return (
    <div>
      <PageHead
        title="Shipping & pickup"
        text="Delivery options, prices, carriers with tracking links, and the days and times customers can collect in the shop. Checkout uses exactly what you set here."
        actions={<Link href="/admin/settings/shipping?edit=new" scroll={false} className="btn btn-primary text-sm">Add a delivery option</Link>}
      />
      <Notice msg={!edit && !editPickup ? msg : undefined} />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Delivery options" text="Customers see the active ones at checkout, in this order.">
          <ul className="-mx-2 divide-y divide-line">
            {methods.map((m) => (
              <li key={m.id} className={`flex items-center gap-3 px-2 py-2.5 ${m.active ? "" : "opacity-55"}`}>
                <Link href={`/admin/settings/shipping?edit=${m.id}`} scroll={false} className="min-w-0 flex-1 rounded-lg px-1 py-0.5 hover:bg-surface">
                  <span className="block truncate text-sm font-medium">{m.name_de || m.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {TYPE_LABEL[m.type] ?? m.type}{m.carrier ? ` · ${m.carrier}` : ""} · {Number(m.price) ? money(m.price) : "free"}{m.free_from != null ? ` · free from ${money(m.free_from)}` : ""}{Number(m.min_order) ? ` · min. ${money(m.min_order)}` : ""}
                  </span>
                </Link>
                <form action={toggleShippingMethod}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={String(!m.active)} />
                  <button className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface">{m.active ? "Switch off" : "Switch on"}</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Pickup in the shop"
          text="Opening times for collection, slot length, and how many orders fit in one slot."
          actions={<Link href="/admin/settings/shipping?pickup=1" scroll={false} className="btn btn-ghost h-8 px-3 py-1 text-xs">Edit</Link>}
        >
          <ul className="space-y-1 text-sm">
            {DAYS.map(([k, l]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-muted">{l}</span>
                <span>{p.days[k as keyof typeof p.days]?.length ? p.days[k as keyof typeof p.days].map((w) => `${w.from}–${w.to}`).join(", ") : "closed"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Slots of {p.slotMinutes} min · earliest {p.leadHours} h after ordering · {p.daysAhead} days ahead · {p.capacity ? `${p.capacity} orders per slot` : "no limit per slot"}
            {p.closed.length ? ` · closed on ${p.closed.length} day(s)` : ""}
          </p>
          {preview.length > 0 && <p className="mt-2 text-xs">Next free slots: {preview.map((s) => s.label.de).join(" · ")}</p>}
        </Card>
      </div>

      <Card className="mt-5" title="Dropshipping" text="Products marked Dropship in the product editor are ordered from their supplier automatically when a customer pays; the supplier ships straight to the customer.">
        <p className="text-sm">Set the supplier and its email or WhatsApp under <Link href="/admin/suppliers" className="text-forest underline">Suppliers</Link> (tick “Dropshipper”), then mark products as Dropship in <Link href="/admin/products" className="text-forest underline">Products</Link>.</p>
      </Card>

      {editing && (
        <SidePanel title={editing.id ? editing.name_de || editing.name : "New delivery option"} closeHref="/admin/settings/shipping">
          <Notice msg={msg} />
          <form action={saveShippingMethod} className="space-y-4 pb-16">
            {editing.id && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="name_de">Name (German)</label><input id="name_de" name="name_de" defaultValue={editing.name_de ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="name">Name (English)</label><input id="name" name="name" defaultValue={editing.name ?? ""} required className="input" /></div>
              <div><label className="label" htmlFor="description_de">Short note (German)</label><input id="description_de" name="description_de" defaultValue={editing.description_de ?? ""} placeholder="z. B. 2–3 Werktage" className="input" /></div>
              <div><label className="label" htmlFor="description">Short note (English)</label><input id="description" name="description" defaultValue={editing.description ?? ""} className="input" /></div>
              <div>
                <label className="label" htmlFor="type">Type</label>
                <select id="type" name="type" defaultValue={editing.type} className="input">
                  {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="carrier">Carrier</label>
                <input id="carrier" name="carrier" list="carriers" defaultValue={editing.carrier ?? ""} placeholder="DHL, DPD, GLS…" className="input" />
                <datalist id="carriers">{CARRIERS.map((c) => <option key={c.name} value={c.name} />)}</datalist>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="tracking_url">Tracking link ({"{tracking}"} is replaced by the tracking number)</label>
                <input id="tracking_url" name="tracking_url" defaultValue={editing.tracking_url ?? ""} placeholder={CARRIERS[0].url} className="input text-sm" />
                <p className="mt-1 text-xs text-muted">Common links: {CARRIERS.map((c) => c.name).join(", ")} – pick the carrier and copy its link: {CARRIERS.map((c) => <span key={c.name} className="mr-2 inline-block break-all">{c.name}: <code>{c.url}</code></span>)}</p>
              </div>
              <div><label className="label" htmlFor="price">Price (€)</label><input id="price" name="price" inputMode="decimal" defaultValue={String(editing.price ?? 0).replace(".", ",")} className="input" /></div>
              <div><label className="label" htmlFor="free_from">Free from order value (€)</label><input id="free_from" name="free_from" inputMode="decimal" defaultValue={editing.free_from != null ? String(editing.free_from).replace(".", ",") : ""} placeholder="never free" className="input" /></div>
              <div><label className="label" htmlFor="min_order">Minimum order (€)</label><input id="min_order" name="min_order" inputMode="decimal" defaultValue={String(editing.min_order ?? 0).replace(".", ",")} className="input" /></div>
              <div><label className="label" htmlFor="max_weight_kg">Max. weight (kg)</label><input id="max_weight_kg" name="max_weight_kg" inputMode="decimal" defaultValue={editing.max_weight_g ? String(editing.max_weight_g / 1000).replace(".", ",") : ""} placeholder="no limit" className="input" /></div>
              <div><label className="label" htmlFor="eta">Delivery time</label><input id="eta" name="eta" defaultValue={editing.eta ?? ""} placeholder="1–3 days" className="input" /></div>
              <div><label className="label" htmlFor="sort">Order in the list</label><input id="sort" name="sort" type="number" defaultValue={editing.sort ?? 0} className="input" /></div>
              <div><label className="label" htmlFor="countries">Countries (codes)</label><input id="countries" name="countries" defaultValue={(editing.countries ?? ["DE"]).join(", ")} placeholder="DE, AT, NL" className="input" /></div>
              <div><label className="label" htmlFor="postal_prefixes">Postcodes (local delivery)</label><input id="postal_prefixes" name="postal_prefixes" defaultValue={(editing.postal_prefixes ?? []).join(", ")} placeholder="676, 6765" className="input" /></div>
            </div>
            <Toggle name="active" defaultChecked={editing.active} label="Offer at checkout" />
            <div className="fixed bottom-0 right-0 z-10 w-full max-w-xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
              <button className="btn btn-primary px-6">Save delivery option</button>
            </div>
          </form>
        </SidePanel>
      )}

      {editPickup && (
        <SidePanel title="Pickup times" subtitle="Customers choose one of these slots at checkout." closeHref="/admin/settings/shipping">
          <form action={savePickup} className="space-y-5 pb-16">
            <fieldset className="space-y-2">
              <legend className="label">Opening times for pickup (up to two windows a day, e.g. 10:00–13:00 and 15:00–19:00)</legend>
              {DAYS.map(([k, l]) => {
                const w = p.days[k as keyof typeof p.days] ?? [];
                return (
                  <div key={k} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                    <label className="flex w-32 items-center gap-2 text-sm font-medium"><input type="checkbox" name={`${k}_open`} defaultChecked={w.length > 0} className="h-4 w-4 accent-[var(--forest)]" />{l}</label>
                    {[1, 2].map((n) => (
                      <span key={n} className="flex items-center gap-1 text-sm">
                        <input name={`${k}_from${n}`} type="time" defaultValue={w[n - 1]?.from ?? ""} className="input h-9 w-28 py-1 text-sm" aria-label={`${l} window ${n} from`} />
                        –
                        <input name={`${k}_to${n}`} type="time" defaultValue={w[n - 1]?.to ?? ""} className="input h-9 w-28 py-1 text-sm" aria-label={`${l} window ${n} until`} />
                      </span>
                    ))}
                  </div>
                );
              })}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="slotMinutes">Length of one slot (minutes)</label><input id="slotMinutes" name="slotMinutes" type="number" min={15} step={15} defaultValue={p.slotMinutes} className="input" /></div>
              <div><label className="label" htmlFor="capacity">Orders per slot (0 = no limit)</label><input id="capacity" name="capacity" type="number" min={0} defaultValue={p.capacity} className="input" /></div>
              <div><label className="label" htmlFor="leadHours">Earliest pickup after ordering (hours)</label><input id="leadHours" name="leadHours" type="number" min={0} defaultValue={p.leadHours} className="input" /></div>
              <div><label className="label" htmlFor="daysAhead">Days customers can book ahead</label><input id="daysAhead" name="daysAhead" type="number" min={1} max={60} defaultValue={p.daysAhead} className="input" /></div>
            </div>
            <div><label className="label" htmlFor="closed">Closed days (holidays), e.g. 24.12.2026, 25.12.2026</label><textarea id="closed" name="closed" rows={2} defaultValue={p.closed.map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`).join(", ")} className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="address_de">Pickup address (German)</label><textarea id="address_de" name="address_de" rows={2} defaultValue={p.address.de ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="address_en">Pickup address (English)</label><textarea id="address_en" name="address_en" rows={2} defaultValue={p.address.en ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="note_de">Note at checkout (German)</label><textarea id="note_de" name="note_de" rows={2} defaultValue={p.note.de ?? ""} placeholder="Bitte Bestellnummer mitbringen." className="input" /></div>
              <div><label className="label" htmlFor="note_en">Note at checkout (English)</label><textarea id="note_en" name="note_en" rows={2} defaultValue={p.note.en ?? ""} className="input" /></div>
            </div>
            <Toggle name="allowAsap" defaultChecked={p.allowAsap} label="Also offer “I will call before coming”" />
            <div className="fixed bottom-0 right-0 z-10 w-full max-w-xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
              <button className="btn btn-primary px-6">Save pickup times</button>
            </div>
          </form>
        </SidePanel>
      )}
    </div>
  );
}
