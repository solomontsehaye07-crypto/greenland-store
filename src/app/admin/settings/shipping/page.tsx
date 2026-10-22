import Link from "next/link";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { getFrozenPack, getPickupSettings, getShippingArea, pickupSlots } from "@/lib/commerce";
import { getDhl } from "@/lib/dhl";
import { getGiftSetting, getQtyTiers, nationwideFreeFrom } from "@/lib/perks";
import { Card, Notice, PageHead, SidePanel, Toggle } from "@/components/admin/ui";
import { saveDhlSettings, saveFrozenPack, saveGift, saveQtyTiers, saveShippingArea, savePickup, saveShippingMethod, toggleShippingMethod } from "../actions";

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
  const [p, fp, area, dhl, { data: storeRow }] = await Promise.all([getPickupSettings(), getFrozenPack(), getShippingArea(), getDhl(), supabaseAdmin().from("settings").select("value").eq("key", "public.store").maybeSingle()]);
  const st = (storeRow?.value ?? {}) as Record<string, string>;
  const [stStreet, stHouse] = (st.street ?? "").match(/^(.*?)\s+(\d+\s?[a-zA-Z]?)$/)?.slice(1) ?? [st.street ?? "", ""];
  const snd = { name1: dhl.sender.name1 || st.name || "", name2: dhl.sender.name2, street: dhl.sender.street || stStreet, house: dhl.sender.house || stHouse, postal: dhl.sender.postal || st.postal || "", city: dhl.sender.city || st.city || "", email: dhl.sender.email || st.email || "" };
  const preview = (await pickupSlots(p)).slice(0, 4);
  const [gift, qt] = await Promise.all([getGiftSetting(), getQtyTiers()]);
  const { data: giftProduct } = gift.product_id
    ? await supabaseAdmin().from("products").select("sku, title, title_de, slug, price, stock, status, is_dropship").eq("id", gift.product_id).maybeSingle()
    : { data: null };
  const freeFrom = nationwideFreeFrom(methods.filter((m) => m.active && m.free_from != null) as { free_from: unknown; type: string; countries?: string[] }[]) ?? NaN;
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
                    {TYPE_LABEL[m.type] ?? m.type}{m.carrier ? ` · ${m.carrier}` : ""} · {Number(m.price) ? money(m.price) : "free"}{m.free_from != null ? ` · free from ${money(m.free_from)}` : ""}{m.max_distance_km ? ` · within ${String(m.max_distance_km).replace(".", ",")} km` : ""}{Number(m.min_order) ? ` · min. ${money(m.min_order)}` : ""}
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

      <Card
        className="mt-5"
        title="DHL connection"
        text="Creates the DHL label straight from the order – the customer’s address is sent to DHL, you print the label, and the customer gets the tracking link. Needs a DHL business customer account (Geschäftskunde)."
      >
        <form action={saveDhlSettings} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle name="enabled" defaultChecked={dhl.enabled} label="Use DHL labels" />
            <Toggle name="sandbox" defaultChecked={dhl.sandbox} label="Test mode (DHL sandbox)" hint="Test labels are not real and cost nothing. Switch off when your contract data is in." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["apiKey", "API key (developer.dhl.com)", !!dhl.apiKey],
              ["user", "Business customer system user", !!dhl.user],
              ["password", "Password of that user", !!dhl.password],
            ] as const).map(([k, l, has]) => (
              <div key={k}>
                <label className="label" htmlFor={`dhl-${k}`}>{l}</label>
                <input id={`dhl-${k}`} name={k} type={k === "user" ? "text" : "password"} autoComplete="off" placeholder={has ? "saved – leave empty to keep" : ""} className="input" />
                {has && <label className="mt-1 flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name={`${k}__clear`} /> remove</label>}
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="billingNumber">Billing number (Abrechnungsnummer)</label>
              <input id="billingNumber" name="billingNumber" defaultValue={dhl.billingNumber} placeholder="EKP + 01 + 01, 14 digits" className="input" inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="printFormat">Label size</label>
              <select id="printFormat" name="printFormat" defaultValue={dhl.printFormat} className="input">
                <option value="910-300-700">Label printer 103 × 150 mm</option>
                <option value="910-300-600">Label printer 103 × 199 mm</option>
                <option value="910-300-300">Label printer 105 × 148 mm (A6)</option>
                <option value="A4">Normal printer, A4 paper</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="extraWeightKg">Box and filling weight (kg)</label>
              <input id="extraWeightKg" name="extraWeightKg" defaultValue={String(dhl.extraWeightKg).replace(".", ",")} inputMode="decimal" className="input" />
            </div>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-6">
            <legend className="mb-1 text-sm font-medium">Sender on the label</legend>
            <input name="s_name1" defaultValue={snd.name1} placeholder="Shop name" className="input sm:col-span-3" />
            <input name="s_name2" defaultValue={snd.name2} placeholder="Name line 2 (optional)" className="input sm:col-span-3" />
            <input name="s_street" defaultValue={snd.street} placeholder="Street" className="input sm:col-span-4" />
            <input name="s_house" defaultValue={snd.house} placeholder="No." className="input sm:col-span-2" />
            <input name="s_postal" defaultValue={snd.postal} placeholder="Postcode" className="input sm:col-span-2" />
            <input name="s_city" defaultValue={snd.city} placeholder="City" className="input sm:col-span-2" />
            <input name="s_email" defaultValue={snd.email} placeholder="Email" className="input sm:col-span-2" />
          </fieldset>
          <Toggle name="auto" defaultChecked={dhl.auto} label="Create the label automatically when a parcel order is paid" />
          <Toggle name="shareEmail" defaultChecked={dhl.shareEmail} label="Send the customer’s email and phone to DHL" hint="DHL then announces the parcel and the customer can follow it. Mention this in your privacy policy." />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">Save</button>
            <button name="test" value="1" className="btn btn-ghost">Save and test connection</button>
          </div>
          <p className="text-xs text-muted">Labels work for “Standard delivery (DHL)” orders. Frozen express, local delivery and pickup don’t use DHL.</p>
        </form>
      </Card>

      <Card className="mt-5" title="Delivery area" text="Where customers can have orders delivered. Pickup in store is always possible.">
        <form action={saveShippingArea} className="flex flex-wrap items-center justify-between gap-4">
          <Toggle name="abroad" defaultChecked={area.abroad} label="Deliver outside Germany" hint={area.abroad ? "On: customers can choose other countries at checkout." : "Off: checkout only accepts addresses in Germany."} />
          <button className="btn btn-primary">Save</button>
        </form>
      </Card>

      <Card
        className="mt-5"
        title="Free gift in the cart"
        text={`Customers see a progress bar in the cart with a stop for free delivery${Number.isFinite(freeFrom) ? ` (${money(freeFrom)}, from your delivery options)` : ""} and one for the gift. Once the cart reaches the value below, the gift is added to the order automatically at 0 €. It is counted on the value of the goods after discounts and only offered while the product is in stock.`}
      >
        <form action={saveGift} className="space-y-4">
          <Toggle name="enabled" defaultChecked={gift.enabled} label="Give a free gift" />
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div>
              <label className="label" htmlFor="gift-product">Gift product – SKU or shop link</label>
              <input id="gift-product" name="product" defaultValue={giftProduct?.sku || (giftProduct ? `/p/${giftProduct.slug}` : "")} placeholder="e.g. GL-0123 or https://greenland-afroasia.de/p/…" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="gift-threshold">From cart value (€)</label>
              <input id="gift-threshold" name="threshold" inputMode="decimal" defaultValue={String(gift.threshold).replace(".", ",")} className="input" />
            </div>
          </div>
          {giftProduct && (
            <p className="text-sm">
              Gift: <b>{giftProduct.title_de || giftProduct.title}</b> · worth {money(Number(giftProduct.price))} ·{" "}
              {giftProduct.status !== "active" ? <span className="text-danger">product is not active – the gift is hidden</span> : giftProduct.is_dropship ? "dropship" : Number(giftProduct.stock) > 0 ? `${giftProduct.stock} in stock` : <span className="text-danger">out of stock – the gift is hidden until restocked</span>}
            </p>
          )}
          <button className="btn btn-primary">Save free gift</button>
        </form>
      </Card>

      <Card
        className="mt-5"
        title="Quantity discount"
        text="Customers who take more of the same product pay less per piece. Shown on the product page as price steps and in the cart (“2 more for −10 %”). A discount code and the quantity discount do not add up – per product the bigger one counts. Switch it off per product in the product editor."
      >
        <form action={saveQtyTiers} className="space-y-4">
          <Toggle name="enabled" defaultChecked={qt.enabled} label="Give quantity discounts" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <label className="label" htmlFor={`min${i}`}>From pieces</label>
                <input id={`min${i}`} name={`min${i}`} inputMode="numeric" defaultValue={qt.tiers[i]?.min ?? ""} placeholder="–" className="input" />
                <label className="label mt-2" htmlFor={`pct${i}`}>Discount %</label>
                <input id={`pct${i}`} name={`pct${i}`} inputMode="decimal" defaultValue={qt.tiers[i] ? String(qt.tiers[i].pct).replace(".", ",") : ""} placeholder="–" className="input" />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Leave a box empty to use fewer steps.</p>
          <button className="btn btn-primary">Save quantity discount</button>
        </form>
      </Card>

      <Card
        className="mt-5"
        title="Frozen packaging"
        text="Frozen food is packed in insulated boxes with cooling packs. Every started box is charged at checkout and shown to customers in the cart as a box that fills up."
      >
        <form action={saveFrozenPack} className="space-y-4">
          <Toggle name="enabled" defaultChecked={fp.enabled} label="Charge for frozen packaging" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="boxKg">One box holds up to (kg)</label>
              <input id="boxKg" name="boxKg" defaultValue={String(fp.boxKg).replace(".", ",")} inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="boxPrice">Packaging price per box (€)</label>
              <input id="boxPrice" name="boxPrice" defaultValue={fp.boxPrice.toFixed(2).replace(".", ",")} inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="smallKg">Show the small-amount hint below (kg)</label>
              <input id="smallKg" name="smallKg" defaultValue={String(fp.smallKg).replace(".", ",")} inputMode="decimal" className="input" />
            </div>
          </div>
          <Toggle name="perBoxShipping" defaultChecked={fp.perBoxShipping} label="Frozen delivery price counts per box" hint="Each box travels as its own parcel, so 2 boxes = 2 × the frozen delivery price." />
          <Toggle name="applyLocal" defaultChecked={fp.applyLocal} label="Also charge packaging for local delivery" hint="Off: local delivery and pickup have no packaging charge." />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Own wording for the small-amount hint (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <textarea name="small_de" rows={3} defaultValue={fp.smallNote.de} placeholder="German" className="input" />
              <textarea name="small_en" rows={3} defaultValue={fp.smallNote.en} placeholder="English" className="input" />
            </div>
          </details>
          <p className="text-xs text-muted">
            Example with today’s settings: 6.2 kg frozen = 2 boxes = {money(2 * fp.boxPrice)} packaging
            {fp.perBoxShipping ? " plus 2 × the frozen delivery price" : " plus the frozen delivery price once"}.
          </p>
          <button className="btn btn-primary">Save frozen packaging</button>
        </form>
      </Card>

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
              <div><label className="label" htmlFor="max_distance_km">Local delivery: radius around the shop (km)</label><input id="max_distance_km" name="max_distance_km" inputMode="decimal" defaultValue={editing.max_distance_km != null ? String(editing.max_distance_km).replace(".", ",") : ""} placeholder="e.g. 5 – checked from the customer's address" className="input" /></div>
              <div><label className="label" htmlFor="postal_prefixes">Postcodes (local delivery, only used without a radius)</label><input id="postal_prefixes" name="postal_prefixes" defaultValue={(editing.postal_prefixes ?? []).join(", ")} placeholder="676, 6765" className="input" /></div>
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
