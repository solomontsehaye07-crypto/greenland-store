import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { waLink } from "@/lib/notify";
import { setOrderStatus } from "../../actions";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("*, order_items(*), shipping_methods(name)").eq("id", id).single();
  if (!o) notFound();
  const { data: pos } = await sb.from("purchase_orders").select("id, number, status, suppliers(name)").eq("order_id", id);
  const a = (o.shipping_address ?? {}) as Record<string, string>;
  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-green">← Orders</Link>
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Order #{o.number}</h1>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5">
          <table className="table">
            <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Price</th><th></th></tr></thead>
            <tbody>
              {(o.order_items as { id: number; title: string; sku: string; qty: number; unit_price: number; is_dropship: boolean }[]).map((i) => (
                <tr key={i.id}><td>{i.title}</td><td className="text-xs">{i.sku}</td><td>{i.qty}</td><td>{money(i.unit_price * i.qty)}</td><td className="text-xs">{i.is_dropship ? "dropship" : ""}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 text-right text-sm">
            <div>{(o.shipping_methods as { name: string } | null)?.name}: {money(o.shipping_total)}</div>
            <div className="text-lg font-bold">Total {money(o.total)}</div>
            <div className="text-muted">of which VAT {money(o.tax_total)}</div>
          </div>
          {!!pos?.length && (
            <p className="mt-4 text-sm">
              Dropship orders:{" "}
              {pos.map((p) => (
                <Link key={p.id} href={`/admin/purchase-orders/${p.id}`} className="mr-2 text-green underline">PO-{p.number} ({p.status})</Link>
              ))}
            </p>
          )}
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="text-lg font-bold">Customer</h2>
            <p className="mt-2">{a.name}<br />{a.street}<br />{a.postal} {a.city} {a.country}</p>
            <p className="mt-2">{o.email}<br />{o.phone}</p>
            {o.pickup_slot && <p className="mt-2">Pickup: {o.pickup_slot}</p>}
            {o.notes && <p className="mt-2 rounded-lg bg-gold/30 p-2">{o.notes}</p>}
            {o.phone && (
              <a className="btn btn-ghost mt-3 w-full" target="_blank" rel="noreferrer" href={waLink(o.phone, `Hello ${a.name ?? ""}, this is Greenland Afro Asia Store about your order #${o.number}.`)}>
                Message on WhatsApp
              </a>
            )}
            <p className="mt-3 text-muted">Payment: {o.payment_provider} {o.payment_ref ? `(${o.payment_ref})` : ""} {o.paid_at ? `· paid ${new Date(o.paid_at).toLocaleString("de-DE")}` : "· not paid yet"}</p>
          </section>
          <form action={setOrderStatus} className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <input type="hidden" name="order_id" value={o.id} />
            <h2 className="text-lg font-bold">Update status</h2>
            <select name="status" defaultValue={o.status} className="input">
              {["pending", "paid", "processing", "packed", "shipped", "ready_for_pickup", "delivered", "cancelled", "refunded"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <input name="tracking_number" placeholder="Tracking number" defaultValue={o.tracking_number ?? ""} className="input" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-[var(--green)]" /> Email the customer</label>
            <button className="btn btn-primary w-full">Save</button>
          </form>
        </div>
      </div>
    </div>
  );
}
