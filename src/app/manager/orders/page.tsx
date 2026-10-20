import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { waLink } from "@/lib/notify";
import { Msg } from "../ui";
import { collectRest, moveOrder } from "../actions";

export const dynamic = "force-dynamic";

const GROUPS: { status: string[]; title: string; next: [string, string][] }[] = [
  { status: ["paid", "processing"], title: "To pack", next: [["packed", "Packed"]] },
  { status: ["packed"], title: "Packed", next: [["ready_for_pickup", "Ready for pickup"], ["shipped", "Shipped"]] },
  { status: ["ready_for_pickup"], title: "Waiting for pickup", next: [["delivered", "Collected"]] },
  { status: ["shipped"], title: "On the way", next: [["delivered", "Delivered"]] },
  { status: ["pending"], title: "Waiting for payment", next: [["cancelled", "Cancel"]] },
];

export default async function Orders({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select("id, number, status, total, balance_due, payment_method, fulfillment_type, pickup_slot, phone, email, created_at, shipping_address, order_items(qty)")
    .in("status", ["pending", "paid", "processing", "packed", "ready_for_pickup", "shipped"])
    .order("created_at")
    .limit(200);
  const orders = data ?? [];
  return (
    <div>
      <Msg msg={msg} />
      {!orders.length && <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">No open orders. 🎉</p>}
      {GROUPS.map((g) => {
        const list = orders.filter((o) => g.status.includes(o.status));
        if (!list.length) return null;
        return (
          <section key={g.title} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold">{g.title} <span className="text-muted">({list.length})</span></h2>
            <ul className="space-y-3">
              {list.map((o) => {
                const a = (o.shipping_address ?? {}) as { name?: string; city?: string };
                const units = (o.order_items as { qty: number }[]).reduce((s, i) => s + i.qty, 0);
                return (
                  <li key={o.id} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/orders/${o.id}`} className="text-sm font-semibold hover:underline">#{o.number}</Link>
                        <span className="ml-2 text-sm" data-no-translate>{a.name}</span>
                        <p className="mt-0.5 text-xs text-muted">
                          {units} items · {o.fulfillment_type === "pickup" ? "Pickup" : o.fulfillment_type === "local" ? "Local delivery" : "Parcel"}
                          {o.pickup_slot ? ` · ${o.pickup_slot}` : ""} · {new Date(o.created_at).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{money(o.total)}</p>
                        {Number(o.balance_due) > 0 && <p className="text-xs font-medium text-terra">{money(o.balance_due)} to collect</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {g.next.filter(([s]) => s !== "ready_for_pickup" || o.fulfillment_type === "pickup").filter(([s]) => s !== "shipped" || o.fulfillment_type !== "pickup").map(([s, l]) => (
                        <form key={s} action={moveOrder}>
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="status" value={s} />
                          <button className={`btn h-9 px-4 py-1 text-sm ${s === "cancelled" ? "btn-ghost" : "btn-primary"}`}>{l}</button>
                        </form>
                      ))}
                      {Number(o.balance_due) > 0 && (
                        <form action={collectRest}>
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="what" value={o.payment_method === "bank" ? "full" : "balance"} />
                          <button className="btn btn-ghost h-9 px-4 py-1 text-sm">{o.payment_method === "bank" ? "Transfer received" : "Paid on collection"}</button>
                        </form>
                      )}
                      {o.phone && <a href={waLink(o.phone, `Hallo ${a.name ?? ""}, hier ist Greenland Afro Asia Store wegen Ihrer Bestellung #${o.number}.`)} target="_blank" rel="noreferrer" className="btn btn-ghost h-9 px-4 py-1 text-sm">WhatsApp</a>}
                      {o.phone && <a href={`tel:${o.phone}`} className="btn btn-ghost h-9 px-4 py-1 text-sm">Call</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted">Moving an order emails the customer (shipped, ready for pickup, delivered, cancelled).</p>
    </div>
  );
}
