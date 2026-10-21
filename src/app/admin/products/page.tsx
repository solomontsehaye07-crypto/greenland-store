import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { Notice, PageHead, SidePanel } from "@/components/admin/ui";
import { createProductAction, quickPrice } from "./actions";
import { ImageField } from "@/components/admin/media-picker";
import { ProductPanel } from "./product-panel";

export const dynamic = "force-dynamic";
const PAGE = 50;

type SP = { q?: string; filter?: string; cat?: string; page?: string; edit?: string; msg?: string; new?: string };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff();
  const sp = await searchParams;
  const { q = "", filter = "", cat = "", page = "1", edit, msg, new: isNew } = sp;
  const sb = supabaseAdmin();
  const { data: cats } = await sb.from("categories").select("id, title, title_de, parent_id").order("sort");
  let query = sb
    .from("products")
    .select("id, sku, title, title_de, price, compare_at_price, sale_ends_at, cost_price, stock, reorder_point, status, image_url, categories(title_de, title)", { count: "exact" })
    .order("title");
  const term = q.replace(/[%,()]/g, "");
  if (term) query = query.or(`title.ilike.%${term}%,title_de.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`);
  if (cat) {
    const ids = (cats ?? []).filter((c) => String(c.id) === cat || String(c.parent_id) === cat).map((c) => c.id);
    query = query.in("category_id", ids);
  }
  if (filter === "offer") query = query.not("compare_at_price", "is", null);
  if (filter === "low") {
    const { data: low } = await sb.from("low_stock").select("id");
    query = query.in("id", (low ?? []).map((l) => l.id).concat(-1));
  }
  if (filter === "out") query = query.lte("stock", 0);
  if (filter === "nophoto") query = query.is("image_url", null);
  if (filter === "hidden") query = query.neq("status", "active");
  const p = Math.max(1, Number(page));
  const { data, count } = await query.range((p - 1) * PAGE, p * PAGE - 1);
  const rows = data ?? [];

  const base = { q, filter, cat, page: String(p) };
  const href = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...o })) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };
  const listHref = href({});

  const FILTERS = [
    ["", "All"],
    ["offer", "On offer"],
    ["low", "Running low"],
    ["out", "Out of stock"],
    ["nophoto", "No photo"],
    ["hidden", "Hidden"],
  ];
  const parents = (cats ?? []).filter((c) => !c.parent_id);

  return (
    <div>
      <PageHead
        title="Products"
        text="Click a product to change its photos, price, offer, texts and where it shows on the home page. Change a price right in the list and press Enter."
        actions={
          <>
            <Link href="/admin/import" className="btn btn-ghost text-sm">Batch import</Link>
            <Link href="/admin/goods-in" className="btn btn-ghost text-sm">Goods in</Link>
            <Link href="/admin/products?new=1" scroll={false} className="btn btn-primary text-sm">New product</Link>
          </>
        }
      />
      {!edit && !isNew && <Notice msg={msg} />}

      <div className="rounded-2xl border border-line bg-white">
        <form className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <input name="q" defaultValue={q} placeholder="Search name, SKU or brand" className="input h-10 max-w-xs py-2 text-sm" />
          <select name="cat" defaultValue={cat} className="input h-10 w-auto py-2 text-sm">
            <option value="">All categories</option>
            {parents.map((pc) => (
              <optgroup key={pc.id} label={pc.title_de || pc.title}>
                <option value={pc.id}>All {pc.title_de || pc.title}</option>
                {(cats ?? []).filter((c) => c.parent_id === pc.id).map((c) => <option key={c.id} value={c.id}>{c.title_de || c.title}</option>)}
              </optgroup>
            ))}
          </select>
          <input type="hidden" name="filter" value={filter} />
          <button className="btn btn-primary h-10 py-2 text-sm">Search</button>
          <div className="ml-auto flex flex-wrap gap-1">
            {FILTERS.map(([k, l]) => (
              <Link key={k} href={href({ filter: k, page: "1" })} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === k ? "bg-ink text-white" : "hover:bg-surface"}`}>{l}</Link>
            ))}
          </div>
        </form>

        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const onOffer = r.compare_at_price && Number(r.compare_at_price) > Number(r.price);
            const catName = (r.categories as unknown as { title_de: string | null; title: string } | null);
            return (
              <li key={r.id} className={`flex items-center gap-3 px-3 py-2 ${r.status !== "active" ? "opacity-55" : ""} ${String(r.id) === edit ? "bg-forest/5" : ""}`}>
                <Link href={href({ edit: String(r.id) })} scroll={false} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 hover:bg-surface/60">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" loading="lazy" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-[0.625rem] text-muted">No photo</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title_de || r.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.sku} · {catName?.title_de || catName?.title || "No category"} · Stock <span className={r.stock <= r.reorder_point ? "font-semibold text-danger" : ""}>{r.stock}</span>
                    </span>
                  </span>
                </Link>
                {onOffer && (
                  <span className="hidden shrink-0 rounded-full bg-terra/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-terra sm:inline">
                    Offer · was {money(r.compare_at_price)}
                  </span>
                )}
                <form action={quickPrice} className="flex shrink-0 items-center gap-1">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="return" value={listHref} />
                  <label className="sr-only" htmlFor={`price-${r.id}`}>Price of {r.title}</label>
                  <input id={`price-${r.id}`} name="price" defaultValue={Number(r.price).toFixed(2).replace(".", ",")} inputMode="decimal" className="input h-9 w-24 py-1 text-right text-sm tabular-nums" />
                  <span className="text-xs text-muted">€</span>
                  <button className="sr-only">Save price</button>
                </form>
              </li>
            );
          })}
          {!rows.length && <li className="px-4 py-10 text-center text-sm text-muted">No products match. Try another search or filter.</li>}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
          <span>{count ?? 0} products</span>
          <div className="flex gap-2">
            {p > 1 && <Link className="btn btn-ghost h-9 py-1 text-sm" href={href({ page: String(p - 1) })}>Previous</Link>}
            {p * PAGE < (count ?? 0) && <Link className="btn btn-ghost h-9 py-1 text-sm" href={href({ page: String(p + 1) })}>Next</Link>}
          </div>
        </div>
      </div>

      {isNew && (
        <SidePanel title="New product" subtitle="The essentials first. Photos, texts and offers come in the next step." closeHref={listHref}>
          <Notice msg={msg} />
          <NewProductPanel cats={cats ?? []} suppliers={(await sb.from("suppliers").select("id, name").eq("active", true).order("name")).data ?? []} />
        </SidePanel>
      )}

      {edit && (
        <ProductPanelLoader id={Number(edit)} closeHref={listHref} msg={msg} returnHref={href({ edit })} />
      )}
    </div>
  );
}

async function ProductPanelLoader({ id, closeHref, returnHref, msg }: { id: number; closeHref: string; returnHref: string; msg?: string }) {
  const sb = supabaseAdmin();
  const [{ data: prod }, { data: cats }, { data: secs }, { data: allSups }, { data: links }] = await Promise.all([
    sb.from("products").select("*").eq("id", id).maybeSingle(),
    sb.from("categories").select("id, title, title_de, parent_id").order("sort"),
    sb.from("home_sections").select("id, type, enabled, data").in("type", ["products", "offers"]).order("position"),
    sb.from("suppliers").select("id, name, specialties").eq("active", true).order("name"),
    sb.from("supplier_products").select("supplier_id, is_preferred").eq("product_id", id),
  ]);
  if (!prod) return null;
  const supplierChoice = (allSups ?? []).map((x) => ({
    id: x.id as number,
    name: x.name as string,
    specialties: (x.specialties ?? []) as string[],
    linked: (links ?? []).some((l) => l.supplier_id === x.id),
    preferred: prod.supplier_id === x.id || (links ?? []).some((l) => l.supplier_id === x.id && l.is_preferred),
  }));
  const picked = (secs ?? [])
    .filter((s) => (s.data as Record<string, unknown>)?.source === "picked")
    .map((s) => {
      const d = s.data as { title?: { de?: string; en?: string }; productIds?: number[] };
      return { id: s.id, title: d.title?.de || d.title?.en || (s.type === "offers" ? "Angebote" : "Product section"), enabled: s.enabled, has: (d.productIds ?? []).map(Number).includes(id), type: s.type };
    });
  return (
    <SidePanel title={prod.title_de || prod.title} subtitle={<>{prod.sku} · <Link href={`/p/${prod.slug}`} target="_blank" className="underline">view in shop</Link> · <Link href={`/admin/products/${prod.id}`} className="underline">stock & supplier</Link></>} closeHref={closeHref} wide>
      <Notice msg={msg} />
      <ProductPanel p={prod} cats={cats ?? []} sections={picked} suppliers={supplierChoice} returnHref={returnHref} />
    </SidePanel>
  );
}

function NewProductPanel({ cats, suppliers }: { cats: { id: number; title: string; title_de: string | null; parent_id: number | null }[]; suppliers: { id: number; name: string }[] }) {
  const parents = cats.filter((c) => !c.parent_id);
  return (
    <form action={createProductAction} className="space-y-4 pb-16">
      <input type="hidden" name="return" value="/admin/products?new=1" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="n-title_de">Name (German) *</label><input id="n-title_de" name="title_de" required className="input" /></div>
        <div><label className="label" htmlFor="n-title">Name (English)</label><input id="n-title" name="title" className="input" /></div>
        <div><label className="label" htmlFor="n-brand">Brand</label><input id="n-brand" name="brand" className="input" /></div>
        <div><label className="label" htmlFor="n-ean">Barcode (EAN)</label><input id="n-ean" name="ean" inputMode="numeric" className="input" /></div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="n-cat">Category *</label>
          <select id="n-cat" name="category_id" required className="input">
            <option value="">Choose…</option>
            {parents.map((pc) => (
              <optgroup key={pc.id} label={pc.title_de || pc.title}>
                {cats.filter((c) => c.parent_id === pc.id).map((c) => <option key={c.id} value={c.id}>{c.title_de || c.title}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div><label className="label" htmlFor="n-price">Selling price € (incl. VAT) *</label><input id="n-price" name="price" inputMode="decimal" required className="input" /></div>
        <div>
          <label className="label" htmlFor="n-vat">VAT</label>
          <select id="n-vat" name="tax_rate" className="input"><option value="7">7 % (food)</option><option value="19">19 % (cosmetics, deco, drinks)</option></select>
        </div>
        <div><label className="label" htmlFor="n-cost">Purchase cost € (net)</label><input id="n-cost" name="cost_price" inputMode="decimal" className="input" /></div>
        <div>
          <label className="label" htmlFor="n-sup">Supplier</label>
          <select id="n-sup" name="supplier_id" className="input"><option value="">None</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div><label className="label" htmlFor="n-stock">Stock on hand now</label><input id="n-stock" name="stock" type="number" min={0} defaultValue={0} className="input" /></div>
        <div><label className="label" htmlFor="n-bbd">Best before</label><input id="n-bbd" name="best_before" type="date" className="input" /></div>
      </div>
      <div><span className="label">Main photo</span><ImageField value="" name="image_url" /></div>
      <div className="fixed bottom-0 right-0 z-10 w-full max-w-xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
        <button className="btn btn-primary px-6">Create product</button>
      </div>
    </form>
  );
}
