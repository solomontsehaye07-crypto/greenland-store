import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { adjustStock, assignSupplier, updateProduct } from "../../actions";

export default async function AdminProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const id = Number((await params).id);
  const sb = supabaseAdmin();
  const [{ data: p }, { data: cats }, { data: sups }, { data: moves }, { data: batches }, { data: sp }] = await Promise.all([
    sb.from("products").select("*").eq("id", id).single(),
    sb.from("categories").select("id, title, parent_id").order("sort"),
    sb.from("suppliers").select("id, name").eq("active", true).order("name"),
    sb.from("stock_movements").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("stock_batches").select("*").eq("product_id", id).gt("quantity_left", 0).order("best_before"),
    sb.from("supplier_products").select("*, suppliers(name)").eq("product_id", id),
  ]);
  if (!p) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/products" className="text-sm text-forest">← Products</Link>
        <h1 className="display mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{p.title}</h1>
        <p className="text-sm text-muted">{p.sku} · <Link href={`/p/${p.slug}`} className="underline">view in shop</Link></p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <form action={updateProduct} className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <input type="hidden" name="id" value={p.id} />
          <h2 className="text-[0.9375rem] font-semibold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Title</label><input name="title" defaultValue={p.title} className="input" /></div>
            <div><label className="label">German title</label><input name="title_de" defaultValue={p.title_de ?? ""} className="input" /></div>
            <div><label className="label">Brand</label><input name="brand" defaultValue={p.brand ?? ""} className="input" /></div>
            <div><label className="label">Country of origin</label><input name="country" defaultValue={p.country ?? ""} className="input" placeholder="e.g. Ethiopia" /></div>
            <div><label className="label">Also show under (comma separated)</label><input name="also_countries" defaultValue={(p.also_countries ?? []).join(", ")} className="input" placeholder="e.g. Eritrea" /></div>
            <div><label className="label">Price (gross €)</label><input name="price" type="number" step="0.01" defaultValue={p.price} className="input" /></div>
            <div><label className="label">Compare-at price (sale)</label><input name="compare_at_price" type="number" step="0.01" defaultValue={p.compare_at_price ?? ""} className="input" /></div>
            <div><label className="label">Cost price (net €)</label><input name="cost_price" type="number" step="0.01" defaultValue={p.cost_price ?? ""} className="input" /></div>
            <div>
              <label className="label">VAT</label>
              <select name="tax_rate" defaultValue={String(Number(p.tax_rate))} className="input"><option value="7">7 % (food)</option><option value="19">19 %</option></select>
            </div>
            <div>
              <label className="label">Category</label>
              <select name="category_id" defaultValue={p.category_id ?? ""} className="input">
                {(cats ?? []).filter((c) => c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={p.status} className="input"><option value="active">Active</option><option value="hidden">Hidden</option><option value="draft">Draft</option></select>
            </div>
            <div><label className="label">Weight incl. packaging (g)</label><input name="weight_g" type="number" defaultValue={p.weight_g} className="input" /></div>
            <div><label className="label">Reorder point</label><input name="reorder_point" type="number" defaultValue={p.reorder_point} className="input" /></div>
            <div><label className="label">Reorder quantity</label><input name="reorder_qty" type="number" defaultValue={p.reorder_qty} className="input" /></div>
            <div className="flex items-end gap-3 sm:col-span-2">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-surface object-cover" />
              )}
              <div className="flex-1"><label className="label">Image URL</label><input name="image_url" defaultValue={p.image_url ?? ""} className="input" /></div>
            </div>
            <div className="sm:col-span-2"><label className="label">Description, English (HTML allowed)</label><textarea name="description" rows={4} defaultValue={p.description ?? ""} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Beschreibung, Deutsch (shown when the shop is in German; leave empty to use the English text)</label><textarea name="description_de" rows={4} defaultValue={p.description_de ?? ""} className="input" /></div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            {[["is_frozen", "Frozen"], ["age_restricted", "18+"], ["is_dropship", "Dropship (supplier ships)"], ["featured", "Featured"]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="hidden" name={`${k}__present`} value="1" />
                <input type="checkbox" name={k} defaultChecked={p[k]} className="accent-[var(--green)]" /> {l}
              </label>
            ))}
          </div>
          <button className="btn btn-primary">Save product</button>
        </form>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-[0.9375rem] font-semibold">Stock: {p.stock}</h2>
            <form action={adjustStock} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="product_id" value={p.id} />
              <div>
                <label className="label">Action</label>
                <select name="mode" className="input">
                  <option value="receive">Receive delivery</option>
                  <option value="count">Set counted stock</option>
                  <option value="adjust">Correct (+/−)</option>
                  <option value="spoiled">Spoiled / rotten (thrown away)</option>
                  <option value="theft">Stolen / missing</option>
                  <option value="own_use">Own use (Eigenverbrauch)</option>
                  <option value="damage">Damaged</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div><label className="label">Quantity</label><input name="qty" type="number" required className="input" /></div>
              <div><label className="label">Cost per item, net € (deliveries)</label><input name="cost" inputMode="decimal" placeholder={p.cost_price ? String(p.cost_price) : ""} className="input" /></div>
              <div><label className="label">Best before</label><input name="best_before" type="date" className="input" /></div>
              <div><label className="label">Lot</label><input name="lot" className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Note</label><input name="note" className="input" /></div>
              <button className="btn btn-primary sm:col-span-2">Book stock</button>
            </form>
            {batches && batches.length > 0 && (
              <ul className="mt-4 text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="flex justify-between border-t border-line py-1.5">
                    <span>Batch {b.lot_code ?? b.id}: {b.quantity_left} left</span>
                    <span className="text-muted">{b.best_before ? `BBD ${new Date(b.best_before).toLocaleDateString("de-DE")}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-[0.9375rem] font-semibold">Supplier</h2>
            <ul className="mt-2 text-sm">
              {(sp ?? []).map((s) => (
                <li key={s.supplier_id}>{(s.suppliers as { name: string }).name}{s.is_preferred ? " (preferred)" : ""} {s.supplier_sku ? `· ${s.supplier_sku}` : ""} {s.cost_price ? `· ${s.cost_price} €` : ""}</li>
              ))}
            </ul>
            <form action={assignSupplier} className="mt-3 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="product_id" value={p.id} />
              <select name="supplier_id" required className="input sm:col-span-3">
                <option value="">Choose supplier…</option>
                {(sups ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input name="supplier_sku" placeholder="Supplier article no." className="input" />
              <input name="cost_price" type="number" step="0.01" placeholder="Cost €" className="input" />
              <button className="btn btn-ghost">Set preferred</button>
            </form>
            {!sups?.length && <p className="mt-2 text-sm text-muted"><Link href="/admin/suppliers/new" className="text-forest underline">Add your first supplier</Link></p>}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-[0.9375rem] font-semibold">Stock history</h2>
            <ul className="mt-2 text-sm">
              {(moves ?? []).map((m) => (
                <li key={m.id} className="flex justify-between border-t border-line py-1.5">
                  <span>{m.reason}{m.note ? ` – ${m.note}` : ""}</span>
                  <span className={m.qty_change > 0 ? "text-green" : "text-danger"}>{m.qty_change > 0 ? "+" : ""}{m.qty_change}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
