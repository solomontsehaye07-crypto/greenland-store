import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { AreaChart, Bars, Donut, Gauge } from "@/components/admin/charts";
import { createDrafts, resolveAlert } from "./actions";

const RANGES = [7, 30, 90] as const;
const PAID = ["paid", "processing", "packed", "shipped", "ready_for_pickup", "delivered"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment", paid: "Paid", processing: "Processing", packed: "Packed", shipped: "Shipped",
  ready_for_pickup: "Ready for pickup", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};
const FULFIL_LABEL: Record<string, string> = { parcel: "Parcel", frozen: "Frozen express", local: "Local delivery", pickup: "Pickup", dropship: "Dropship" };

function Card({ title, children, action, className = "" }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaff();
  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - days * 86400000);
  since.setHours(0, 0, 0, 0);
  const prevSince = new Date(since.getTime() - days * 86400000);
  const [
    { data: orders }, { data: prev }, { data: items }, { data: products }, { data: cats },
    { data: low }, { data: expiring }, { data: alerts }, { count: openOrders }, { count: drafts },
    { count: subs }, { count: newSubs }, { data: recent },
  ] = await Promise.all([
    sb.from("orders").select("total, status, fulfillment_type, created_at").gte("created_at", since.toISOString()),
    sb.from("orders").select("total, status").gte("created_at", prevSince.toISOString()).lt("created_at", since.toISOString()),
    sb.from("order_items").select("product_id, title, qty, unit_price, orders!inner(created_at, status)").gte("orders.created_at", since.toISOString()).in("orders.status", PAID),
    sb.from("products").select("id, category_id, stock, price, cost_price, reorder_point, image_url, status, title_de").neq("status", "draft").limit(5000),
    sb.from("categories").select("id, slug, title, parent_id"),
    sb.from("low_stock").select("id, sku, title, stock, reorder_point, supplier_name, on_order").order("stock").limit(15),
    sb.from("expiring_batches").select("id, title, best_before, quantity_left").order("best_before").limit(10),
    sb.from("alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(10),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing", "packed"]),
    sb.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "draft"),
    sb.from("subscribers").select("id", { count: "exact", head: true }),
    sb.from("subscribers").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    sb.from("orders").select("id, number, email, total, status, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  // ---- sales
  const paid = (orders ?? []).filter((o) => PAID.includes(o.status));
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const prevRevenue = (prev ?? []).filter((o) => PAID.includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
  const aov = paid.length ? revenue / paid.length : 0;
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000);
    return { date: d.toISOString().slice(0, 10), value: 0 };
  });
  for (const o of paid) {
    const k = o.created_at.slice(0, 10);
    const row = daily.find((d) => d.date === k);
    if (row) row.value += Number(o.total);
  }
  const byStatus = Object.entries(
    (orders ?? []).reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})
  ).map(([k, v]) => ({ label: STATUS_LABEL[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  const byFulfil = Object.entries(
    paid.reduce<Record<string, number>>((m, o) => ((m[o.fulfillment_type] = (m[o.fulfillment_type] ?? 0) + 1), m), {})
  ).map(([k, v]) => ({ label: FULFIL_LABEL[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  const topMap = new Map<string, { label: string; value: number; href?: string }>();
  for (const it of items ?? []) {
    const k = String(it.product_id ?? it.title);
    const row = topMap.get(k) ?? { label: it.title, value: 0, href: it.product_id ? `/admin/products/${it.product_id}` : undefined };
    row.value += Number(it.unit_price) * it.qty;
    topMap.set(k, row);
  }
  const top = [...topMap.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  const change = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  // ---- catalogue health
  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const deptOf = (id: number | null) => {
    let c = id ? catById.get(id) : undefined;
    while (c?.parent_id) c = catById.get(c.parent_id);
    return c;
  };
  const active = (products ?? []).filter((p) => p.status === "active");
  const inStock = active.filter((p) => p.stock > 0).length;
  const aboveReorder = active.filter((p) => p.stock > p.reorder_point).length;
  const withPhoto = active.filter((p) => p.image_url).length;
  const translated = active.filter((p) => p.title_de).length;
  const pct = (n: number) => (active.length ? (n / active.length) * 100 : 0);
  const stockValue = active.reduce((s, p) => s + Math.max(p.stock, 0) * Number(p.cost_price ?? p.price), 0);
  const usesCost = active.some((p) => p.cost_price != null);
  const deptMap = new Map<string, { label: string; value: number; href?: string }>();
  for (const p of active) {
    const d = deptOf(p.category_id);
    const key = d?.slug ?? "none";
    const row = deptMap.get(key) ?? { label: d?.title ?? "No category", value: 0, href: d ? `/c/${d.slug}` : undefined };
    row.value += Math.max(p.stock, 0) * Number(p.cost_price ?? p.price);
    deptMap.set(key, row);
  }
  const depts = [...deptMap.values()].sort((a, b) => b.value - a.value);

  const kpis = [
    { label: `Revenue, last ${days} days`, value: money(revenue), sub: change == null ? "No sales in the period before" : `${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs. the ${days} days before`, href: "/admin/orders" },
    { label: "Paid orders", value: String(paid.length), sub: `Average order ${money(aov)}`, href: "/admin/orders" },
    { label: "Orders to fulfil", value: String(openOrders ?? 0), sub: "Paid, processing or packed", href: "/admin/orders?status=open" },
    { label: "Stock value", value: money(stockValue), sub: usesCost ? "At cost price where known" : "At selling price (add cost prices for margin)", href: "/admin/products" },
    { label: "Newsletter subscribers", value: String(subs ?? 0), sub: `${newSubs ?? 0} new in the last ${days} days`, href: "/admin/subscribers" },
    { label: "Draft refill orders", value: String(drafts ?? 0), sub: `${low?.length ?? 0} products at reorder point`, href: "/admin/purchase-orders" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Overview</h1>
        <nav className="flex rounded-full bg-white p-1 text-sm" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin?range=${r}`} aria-current={r === days ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 font-medium ${r === days ? "bg-ink text-paper" : "hover:bg-surface"}`}>
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-2xl border border-line bg-white p-5 hover:ring-2 hover:ring-forest/20">
            <div className="text-sm text-muted">{k.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{k.value}</div>
            <div className="mt-1 text-xs text-muted">{k.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Revenue per day" className="xl:col-span-2">
          <AreaChart points={daily} label="Revenue per day" />
          {revenue === 0 && <p className="mt-2 text-sm text-muted">No paid orders in this period yet. The chart fills in as orders come in.</p>}
        </Card>
        <Card title="Orders by status">
          {byStatus.length ? <Donut items={byStatus} centerLabel="orders" /> : <p className="text-sm text-muted">No orders in this period.</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Best sellers" className="lg:col-span-2">
          {top.length ? <Bars items={top} format="eur" /> : <p className="text-sm text-muted">Your best-selling products will show here once orders are paid.</p>}
        </Card>
        <Card title="How customers get their orders">
          {byFulfil.length ? <Donut items={byFulfil} centerLabel="paid orders" /> : <p className="text-sm text-muted">Delivery, pickup and frozen express split appears with the first paid orders.</p>}
        </Card>
      </div>

      <Card title="Catalogue health" action={<Link href="/admin/products" className="text-sm text-forest underline">Manage products</Link>}>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Gauge value={pct(inStock)} label="In stock" detail={`${inStock} of ${active.length} products`} />
          <Gauge value={pct(aboveReorder)} label="Above reorder point" detail={`${active.length - aboveReorder} need a refill`} />
          <Gauge value={pct(withPhoto)} label="Have a photo" detail={`${active.length - withPhoto} without photo`} good={95} ok={80} />
          <Gauge value={pct(translated)} label="German title" detail={`${active.length - translated} English only`} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Stock value by department">
          {depts.length ? <Bars items={depts} format="eur" color="var(--forest)" /> : <p className="text-sm text-muted">No products yet.</p>}
        </Card>
        <Card title="Latest orders" action={<Link href="/admin/orders" className="text-sm text-forest underline">All orders</Link>}>
          {recent?.length ? (
            <ul className="divide-y divide-line text-sm">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="min-w-0 hover:text-terra">
                    <span className="font-semibold">#{o.number}</span> <span className="truncate text-muted">{o.email}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{STATUS_LABEL[o.status] ?? o.status}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(o.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No orders yet. When a customer checks out, it shows up here.</p>
          )}
        </Card>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold">Low stock</h2>
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
                  <td><Link href={`/admin/products/${p.id}`} className="hover:text-terra">{p.title}</Link><div className="text-xs text-muted">{p.sku}</div></td>
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
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-[0.9375rem] font-semibold">Expiring within 30 days</h2>
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
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-[0.9375rem] font-semibold">Alerts</h2>
          {alerts?.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{a.message}</span>
                  <form action={resolveAlert}><input type="hidden" name="id" value={a.id} /><button className="text-forest underline">Done</button></form>
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
