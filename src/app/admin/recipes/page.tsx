import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createRecipe } from "./actions";

export const metadata = { title: "Recipes" };

export default async function AdminRecipes() {
  await requireStaff();
  const { data } = await supabaseAdmin().from("recipes").select("id, slug, title, country, published, sort, recipe_items(count)").order("sort").order("id");
  const rows = (data ?? []) as unknown as { id: number; slug: string; title: { de?: string; en?: string }; country: string | null; published: boolean; sort: number; recipe_items: { count: number }[] }[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Recipes</h1>
        <p className="mt-1 text-sm text-muted">
          Dishes linked to your products. Customers see them on product pages and in the cart as &ldquo;goes well together&rdquo;, and on <Link href="/rezepte" className="underline">/rezepte</Link>.
        </p>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Recipe</th><th>Country</th><th>Ingredients</th><th>Status</th><th>Order</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/recipes/${r.id}`} className="font-medium hover:underline">{r.title.de || r.title.en || r.slug}</Link><div className="text-xs text-muted">/rezepte/{r.slug}</div></td>
                  <td>{r.country ?? "–"}</td>
                  <td>{r.recipe_items?.[0]?.count ?? 0}</td>
                  <td>{r.published ? "Published" : <span className="text-muted">Draft</span>}</td>
                  <td>{r.sort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">No recipes yet. Add your first one below.</p>
        )}
      </section>
      <form action={createRecipe} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><label className="label" htmlFor="nr-title">Name (German)</label><input id="nr-title" name="title_de" required className="input" placeholder="Egusi-Suppe" /></div>
        <div><label className="label" htmlFor="nr-slug">Address</label><input id="nr-slug" name="slug" required pattern="[a-z0-9-]+" className="input" placeholder="egusi-soup" /></div>
        <button className="btn btn-primary">Create recipe</button>
      </form>
    </div>
  );
}
