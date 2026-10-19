import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { COUNTRY_INFO } from "@/lib/countries";
import { money } from "@/lib/format";
import { addIngredient, deleteRecipe, removeIngredient, saveRecipe, updateIngredient } from "../actions";

type L = { de?: string; en?: string };

export default async function AdminRecipe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const [{ id: idStr }, { q = "" }] = await Promise.all([params, searchParams]);
  const id = Number(idStr);
  const sb = supabaseAdmin();
  const [{ data: r }, { data: items }, found] = await Promise.all([
    sb.from("recipes").select("*").eq("id", id).maybeSingle(),
    sb.from("recipe_items").select("product_id, essential, note, products(id, title, slug, price, image_url, stock, status)").eq("recipe_id", id),
    q.trim().length >= 2
      ? sb.from("products").select("id, title, price, image_url, stock").neq("status", "draft").ilike("title", `%${q.trim().replace(/[%_]/g, "")}%`).order("title").limit(15)
      : Promise.resolve({ data: [] as { id: number; title: string; price: number; image_url: string | null; stock: number }[] }),
  ]);
  if (!r) notFound();
  const title = r.title as L;
  const intro = r.intro as L;
  const rows = (items ?? []) as unknown as { product_id: number; essential: boolean; note: L; products: { id: number; title: string; slug: string; price: number; image_url: string | null; stock: number; status: string } }[];
  const linked = new Set(rows.map((x) => x.product_id));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/recipes" className="text-sm text-forest">← Recipes</Link>
        <h1 className="mt-2 text-3xl font-extrabold">{title.de || title.en || r.slug}</h1>
        <p className="text-sm text-muted"><Link href={`/rezepte/${r.slug}`} className="underline">/rezepte/{r.slug}</Link>{!r.published && " · draft, not visible to customers"}</p>
      </div>

      <form action={saveRecipe} className="space-y-4 rounded-2xl bg-white p-5">
        <input type="hidden" name="id" value={r.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="t-de">Name, Deutsch</label><input id="t-de" name="title_de" defaultValue={title.de ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="t-en">Name, English</label><input id="t-en" name="title_en" defaultValue={title.en ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="i-de">Short intro, Deutsch</label><textarea id="i-de" name="intro_de" rows={3} defaultValue={intro.de ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="i-en">Short intro, English</label><textarea id="i-en" name="intro_en" rows={3} defaultValue={intro.en ?? ""} className="input" /></div>
          <div className="flex items-end gap-3 sm:col-span-2">
            {r.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-surface object-cover" />
            )}
            <div className="flex-1"><label className="label" htmlFor="img">Photo URL (upload under Website → Media, then paste the link)</label><input id="img" name="image_url" defaultValue={r.image_url ?? ""} className="input" /></div>
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <select id="country" name="country" defaultValue={r.country ?? ""} className="input">
              <option value="">–</option>
              {Object.entries(COUNTRY_INFO).map(([k, v]) => <option key={k} value={k}>{v.flag} {k}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="sort">Order (lower shows first)</label><input id="sort" name="sort" type="number" defaultValue={r.sort} className="input" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={r.published} /> Published (visible to customers)</label>
        <button className="btn btn-primary">Save recipe</button>
      </form>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">Ingredients ({rows.length})</h2>
        <p className="mt-1 text-sm text-muted">Unticked &ldquo;main ingredient&rdquo; shows as optional. Out-of-stock products are hidden from customers automatically.</p>
        <ul className="mt-4 divide-y divide-line">
          {rows.map((x) => (
            <li key={x.product_id} className="flex flex-wrap items-center gap-3 py-3">
              {x.products.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.products.image_url} alt="" className="h-12 w-12 rounded-lg bg-surface object-cover" />
              )}
              <div className="min-w-[12rem] flex-1">
                <Link href={`/admin/products/${x.product_id}`} className="text-sm font-medium hover:underline">{x.products.title}</Link>
                <div className="text-xs text-muted">{money(x.products.price)} · stock {x.products.stock}{x.products.status !== "active" ? ` · ${x.products.status}` : ""}</div>
              </div>
              <form action={updateIngredient} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="recipe_id" value={r.id} />
                <input type="hidden" name="product_id" value={x.product_id} />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="essential" defaultChecked={x.essential} /> Main ingredient</label>
                <input name="note_de" defaultValue={x.note?.de ?? ""} placeholder="Hinweis (z. B. als Beilage)" aria-label="Note, German" className="input w-44 py-1.5 text-xs" />
                <input name="note_en" defaultValue={x.note?.en ?? ""} placeholder="Note (e.g. to serve)" aria-label="Note, English" className="input w-40 py-1.5 text-xs" />
                <button className="btn btn-ghost py-1.5 text-xs">Save</button>
              </form>
              <form action={removeIngredient}>
                <input type="hidden" name="recipe_id" value={r.id} />
                <input type="hidden" name="product_id" value={x.product_id} />
                <button className="text-xs text-danger underline">Remove</button>
              </form>
            </li>
          ))}
        </ul>

        <form className="mt-6 flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Find a product</label>
          <input id="q" name="q" defaultValue={q} placeholder="Find a product to add, e.g. palm oil" className="input flex-1" />
          <button className="btn btn-ghost">Search</button>
        </form>
        {q && (
          <ul className="mt-3 divide-y divide-line">
            {(found.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg bg-surface object-cover" />
                )}
                <span className="flex-1 text-sm">{p.title} <span className="text-xs text-muted">· {money(p.price)} · stock {p.stock}</span></span>
                {linked.has(p.id) ? (
                  <span className="text-xs text-muted">Added</span>
                ) : (
                  <form action={addIngredient}>
                    <input type="hidden" name="recipe_id" value={r.id} />
                    <input type="hidden" name="product_id" value={p.id} />
                    <button className="btn btn-primary py-1.5 text-xs">Add</button>
                  </form>
                )}
              </li>
            ))}
            {!found.data?.length && <li className="py-2 text-sm text-muted">No products match &ldquo;{q}&rdquo;.</li>}
          </ul>
        )}
      </section>

      <form action={deleteRecipe} className="rounded-2xl bg-white p-5">
        <input type="hidden" name="id" value={r.id} />
        <p className="text-sm text-muted">Deleting removes the recipe and its ingredient list. Products stay untouched.</p>
        <button className="mt-3 text-sm text-danger underline">Delete this recipe</button>
      </form>
    </div>
  );
}
