import Link from "next/link";
import { SupplierBadges } from "@/components/supplier-badges";
import { ImageGallery } from "@/components/admin/media-picker";
import { Toggle } from "@/components/admin/ui";
import { endOffer, saveProduct } from "./actions";

type Cat = { id: number; title: string; title_de: string | null; parent_id: number | null };
type Sec = { id: number; title: string; enabled: boolean; has: boolean; type: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = Record<string, any>;

const de = (n: number | null | undefined) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));

function Group({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <h3 className="text-sm font-semibold">{title}</h3>
      {text && <p className="mt-0.5 text-xs text-muted">{text}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

type SupChoice = { id: number; name: string; specialties: string[]; linked: boolean; preferred: boolean };

export function ProductPanel({ p, cats, sections, suppliers = [], returnHref }: { p: P; cats: Cat[]; sections: Sec[]; suppliers?: SupChoice[]; returnHref: string }) {
  const onOffer = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
  const regular = onOffer ? p.compare_at_price : p.price;
  const images: string[] = Array.isArray(p.images) && p.images.length ? p.images : p.image_url ? [p.image_url] : [];
  const parents = cats.filter((c) => !c.parent_id);
  const net = Number(p.price) / (1 + Number(p.tax_rate ?? 7) / 100);
  const margin = p.cost_price ? Math.round(((net - Number(p.cost_price)) / net) * 100) : null;

  return (
    <>
      <form action={saveProduct} className="space-y-4 pb-20">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="return" value={returnHref} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-sm">In stock: <b>{p.stock}</b></p>
          <Link href={`/admin/goods-in?product=${p.id}`} className="btn btn-ghost h-9 py-1 text-sm">Add stock (goods in)</Link>
        </div>

        <Group title="Photos" text="Upload new photos or pick from the media library and the other product photos.">
          <ImageGallery name="images" initial={images} />
        </Group>

        <Group title="Price & offer" text="Fill in an offer price to put the product on offer: the shop shows the regular price crossed out and the offer price in red.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="regular_price">Regular price (€, incl. VAT)</label>
              <input id="regular_price" name="regular_price" defaultValue={de(regular)} inputMode="decimal" required className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="offer_price">Offer price (€)</label>
              <input id="offer_price" name="offer_price" defaultValue={onOffer ? de(p.price) : ""} inputMode="decimal" placeholder="No offer" className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="sale_ends_at">Offer ends on</label>
              <input id="sale_ends_at" name="sale_ends_at" type="date" defaultValue={p.sale_ends_at ? String(p.sale_ends_at).slice(0, 10) : ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="cost_price">Purchase cost (€, net)</label>
              <input id="cost_price" name="cost_price" defaultValue={de(p.cost_price)} inputMode="decimal" className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="tax_rate">VAT</label>
              <select id="tax_rate" name="tax_rate" defaultValue={String(Number(p.tax_rate ?? 7))} className="input">
                <option value="7">7 % (food)</option>
                <option value="19">19 % (cosmetics, deco, drinks)</option>
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted">
                {margin === null ? "Add the purchase cost to see your margin." : <>Margin at today’s price: <b className={margin < 20 ? "text-danger" : "text-forest"}>{margin} %</b></>}
                {" "}<Link href="/admin/pricing" className="underline">Price tool</Link>
              </p>
            </div>
          </div>
          {onOffer && <button formAction={endOffer} formNoValidate className="mt-3 text-sm font-medium text-terra underline">End the offer now</button>}
          <p className="mt-3 text-xs text-muted">Without an end date the offer runs until you remove the offer price. With a date it ends automatically the next morning.</p>
        </Group>

        <Group title="Show on the home page" text="Sections where you choose the products yourself. Create one under Home page → Add a section → Product section (Products you choose) or Offers.">
          {sections.length ? (
            <ul className="space-y-2.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" name="sections" value={s.id} defaultChecked={s.has} className="h-4 w-4 accent-[var(--forest)]" />
                    <span className="font-medium">{s.title}</span>
                    <span className="text-xs text-muted">{s.type === "offers" ? "Offers" : "Product section"}{s.enabled ? "" : " · hidden"}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No hand-picked sections yet. <Link href="/admin/website" className="text-forest underline">Add one on the home page</Link>.</p>
          )}
        </Group>

        <Group title="Name & details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="title_de">Name (German)</label><input id="title_de" name="title_de" defaultValue={p.title_de ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="title">Name (English)</label><input id="title" name="title" defaultValue={p.title} required className="input" /></div>
            <div><label className="label" htmlFor="brand">Brand</label><input id="brand" name="brand" defaultValue={p.brand ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="ean">Barcode (EAN)</label><input id="ean" name="ean" defaultValue={p.ean ?? ""} inputMode="numeric" className="input" /></div>
            <div>
              <label className="label" htmlFor="category_id">Category</label>
              <select id="category_id" name="category_id" defaultValue={p.category_id ?? ""} className="input">
                {parents.map((pc) => (
                  <optgroup key={pc.id} label={pc.title_de || pc.title}>
                    {cats.filter((c) => c.parent_id === pc.id).map((c) => <option key={c.id} value={c.id}>{c.title_de || c.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div><label className="label" htmlFor="country">Country of origin</label><input id="country" name="country" defaultValue={p.country ?? ""} placeholder="e.g. Ethiopia" className="input" /></div>
            <div><label className="label" htmlFor="also_countries">Also show under (comma separated)</label><input id="also_countries" name="also_countries" defaultValue={(p.also_countries ?? []).join(", ")} placeholder="e.g. Eritrea" className="input" /></div>
            <div><label className="label" htmlFor="weight_g">Weight incl. packaging (g)</label><input id="weight_g" name="weight_g" type="number" defaultValue={p.weight_g ?? 0} className="input" /></div>
            <div>
              <label className="label" htmlFor="status">Visible in the shop</label>
              <select id="status" name="status" defaultValue={p.status} className="input">
                <option value="active">Yes, visible</option>
                <option value="hidden">Hidden</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Toggle name="featured" defaultChecked={p.featured} label="Recommended" hint="Shown in “Our recommendations”" />
            <Toggle name="is_frozen" defaultChecked={p.is_frozen} label="Frozen" hint="Only frozen express, local delivery or pickup" />
            <Toggle name="age_restricted" defaultChecked={p.age_restricted} label="18+" hint="Customer confirms age at checkout" />
            <Toggle name="is_dropship" defaultChecked={p.is_dropship} label="Dropship" hint="The supplier ships it directly" />
          </div>
        </Group>

        <Group title="Suppliers" text="Tick every supplier that sells this product, and choose the one you normally order from. Supplier orders and the “running low” list use your choice.">
          <input type="hidden" name="suppliers__present" value="1" />
          {suppliers.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {suppliers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" name="sup" value={s.id} defaultChecked={s.linked || s.preferred} className="h-5 w-5 shrink-0 accent-[var(--green)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium" data-no-translate>{s.name}</span>
                      <SupplierBadges types={s.specialties} compact />
                    </span>
                  </label>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium">
                    <input type="radio" name="sup_pref" value={s.id} defaultChecked={s.preferred} className="h-4 w-4 accent-[var(--green)]" />
                    Order from here
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No suppliers yet.</p>
          )}
        </Group>

        <Group title="Description">
          <div className="space-y-4">
            <div><label className="label" htmlFor="description_de">German</label><textarea id="description_de" name="description_de" rows={5} defaultValue={p.description_de ?? ""} className="input leading-relaxed" /></div>
            <div><label className="label" htmlFor="description">English</label><textarea id="description" name="description" rows={5} defaultValue={p.description ?? ""} className="input leading-relaxed" /></div>
          </div>
        </Group>

        <div className="fixed bottom-0 right-0 z-10 w-full max-w-3xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
          <button className="btn btn-primary px-6">Save product</button>
        </div>
      </form>
    </>
  );
}
