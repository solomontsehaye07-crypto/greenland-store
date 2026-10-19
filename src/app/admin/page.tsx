import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { createDrafts, resolveAlert } from "./actions";

export default async function Dashboard() {
  await requireStaff();
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: orders }, { data: low }, { data: expiring }, { data: alerts }, { count: openOrders }, { count: drafts }] = await Promise.all([
    sb.from("orders").select("total, status, created_at").gte("created_at", since),
    sb.from("low_stock").select("id, sku, title, stock, reorder_point, supplier_name, on_order").order("stock").limit(15),
    sb.from("expiring_batches").select("id, title, best_before, quantity_left").order("best_before").limit(10),
    sb.from("alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(10),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing", "packed"]),
    sb.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  const paid = (orders ?? []).filter((o) => !["pending", "cancelled", "refunded"].includes(o.status));
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);

  const stats = [
    { label: "Revenue, last 30 days", value: money(revenue), href: "/admin/orders" },
    { label: "Orders to fulfil", value: String(openOrders ?? 0), href: "/admin/orders?status=open" },
    { label: "Products at reorder point", value: String(low?.length ?? 0), href: "/admin/products?filter=low" },
    { label: "Draft refill orders", value: String(drafts ?? 0), href: "/admin/purchase-orders" },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl bg-white p-5 hover:ring-2 hover:ring-green/20">
            <div className="text-sm text-muted">{s.label}</div>
            <div className="mt-1 text-3xl font-bold">{s.value}</div>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Low stock</h2>
          <form action={createDrafts}>
            <button className="btn btn-primary">Create refill orders per supplier</button>
          </form>
        </div>
        {low?.length ? (
          <table className="table mt-4">
            <thead><tr><th>Product</th><th>Stock</th><th>Reorder at</th><th>Supplier</th><th></th></tr></thead>
            <tbody>
              {low.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/products/${p.id}`} className="hover:text-green">{p.title}</Link><div className="text-xs text-muted">{p.sku}</div></td>
                  <td className={p.stock <= 0 ? "font-bold text-danger" : "font-semibold"}>{p.stock}</td>
                  <td>{p.reorder_point}</td>
                  <td>{p.supplier_name ?? <span className="text-danger">No supplier set</span>}</td>
                  <td className="text-xs text-muted">{p.on_order ? "On order" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-muted">Everything is above its reorder point.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Expiring within 30 days</h2>
          {expiring?.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {expiring.map((b) => (
                <li key={b.id} className="flex justify-between py-2"><span>{b.quantity_left} × {b.title}</span><span>{new Date(b.best_before).toLocaleDateString("de-DE")}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No batches expire soon. Add best-before dates when you receive stock to track this.</p>
          )}
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Alerts</h2>
          {alerts?.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{a.message}</span>
                  <form action={resolveAlert}><input type="hidden" name="id" value={a.id} /><button className="text-green underline">Done</button></form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No open alerts. The daily check runs every morning at 6:00 UTC.</p>
          )}
        </section>
      </div>
    </div>
  );
}
