import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";

const PAGE = 50;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; cat?: string; page?: string }> }) {
  await requireStaff();
  const { q = "", filter = "", cat = "", page = "1" } = await searchParams;
  const sb = supabaseAdmin();
  const { data: cats } = await sb.from("categories").select("id, title, parent_id").order("sort");
  let query = sb
    .from("products")
    .select("id, sku, title, price, cost_price, stock, reorder_point, status, image_url, price_source, suppliers(name), categories(title)", { count: "exact" })
    .order("title");
  if (q) query = query.or(`title.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%`);
  if (cat) query = query.eq("category_id", Number(cat));
  if (filter === "low") {
    const { data: low } = await sb.from("low_stock").select("id");
    query = query.in("id", (low ?? []).map((l) => l.id).concat(-1));
  }
  if (filter === "out") query = query.lte("stock", 0);
  if (filter === "estimate") query = query.like("price_source", "estimate%");
  if (filter === "nosupplier") query = query.is("supplier_id", null);
  if (filter === "hidden") query = query.neq("status", "active");
  const p = Math.max(1, Number(page));
  const { data, count } = await query.range((p - 1) * PAGE, p * PAGE - 1);
  const rows = data ?? [];
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ q, filter, cat, ...o })}`;

  const FILTERS = [
    ["", "All"],
    ["low", "At reorder point"],
    ["out", "Out of stock"],
    ["estimate", "Estimated prices"],
    ["nosupplier", "No supplier"],
    ["hidden", "Hidden"],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Products & stock</h1>
        <Link href="/admin/import" className="btn btn-ghost">Import stock or prices</Link>
      </div>
      <form className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={q} placeholder="Search title, SKU, brand" className="input max-w-xs" />
        <select name="cat" defaultValue={cat} className="input w-auto">
          <option value="">All categories</option>
          {(cats ?? []).filter((c) => c.parent_id).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <input type="hidden" name="filter" value={filter} />
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={qs({ filter: k, page: "1" })} className={`rounded-full px-3 py-1 text-sm ${filter === k ? "bg-ink text-white" : "bg-white"}`}>{l}</Link>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">{count} products</p>
      <div className="mt-2 overflow-x-auto rounded-2xl bg-white">
        <table className="table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Supplier</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.status !== "active" ? "opacity-50" : ""}>
                <td className="w-12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded object-contain" />}
                </td>
                <td>
                  <Link href={`/admin/products/${r.id}`} className="font-medium hover:text-green">{r.title}</Link>
                  <div className="text-xs text-muted">{r.sku}{r.price_source?.startsWith("estimate") ? " · price estimated" : ""}</div>
                </td>
                <td className="text-sm">{(r.categories as unknown as { title: string } | null)?.title}</td>
                <td>{money(r.price)}</td>
                <td className="text-muted">{r.cost_price ? money(r.cost_price) : "—"}</td>
                <td className={r.stock <= r.reorder_point ? "font-bold text-danger" : ""}>{r.stock}</td>
                <td className="text-sm">{(r.suppliers as unknown as { name: string } | null)?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(count ?? 0) > PAGE && (
        <div className="mt-6 flex gap-2">
          {p > 1 && <Link className="btn btn-ghost" href={qs({ page: String(p - 1) })}>Previous</Link>}
          {p * PAGE < (count ?? 0) && <Link className="btn btn-ghost" href={qs({ page: String(p + 1) })}>Next</Link>}
        </div>
      )}
    </div>
  );
}
