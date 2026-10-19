import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createDrafts, createManualPo } from "../actions";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gold/40",
  sent: "bg-surface",
  confirmed: "bg-surface",
  partially_received: "bg-surface",
  received: "bg-green text-white",
  cancelled: "bg-line",
};

export default async function PurchaseOrders() {
  await requireStaff();
  const sb = supabaseAdmin();
  const [{ data: pos }, { data: sups }] = await Promise.all([
    sb.from("purchase_orders").select("id, number, status, kind, created_at, sent_via, expected_at, suppliers(name), purchase_order_items(qty)").order("created_at", { ascending: false }).limit(100),
    sb.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Refill orders</h1>
        <form action={createDrafts}><button className="btn btn-primary">Draft orders from low stock</button></form>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="table">
          <thead><tr><th>No.</th><th>Supplier</th><th>Type</th><th>Lines</th><th>Status</th><th>Created</th><th>Expected</th></tr></thead>
          <tbody>
            {(pos ?? []).map((po) => (
              <tr key={po.id}>
                <td><Link href={`/admin/purchase-orders/${po.id}`} className="font-semibold text-green">PO-{po.number}</Link></td>
                <td>{(po.suppliers as unknown as { name: string }).name}</td>
                <td>{po.kind}</td>
                <td>{(po.purchase_order_items as { qty: number }[]).length}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[po.status]}`}>{po.status.replace("_", " ")}</span>{po.sent_via ? <span className="ml-1 text-xs text-muted">via {po.sent_via}</span> : null}</td>
                <td>{new Date(po.created_at).toLocaleDateString("de-DE")}</td>
                <td>{po.expected_at ? new Date(po.expected_at).toLocaleDateString("de-DE") : "—"}</td>
              </tr>
            ))}
            {!pos?.length && <tr><td colSpan={7} className="py-8 text-center text-muted">No refill orders yet. They are drafted automatically each morning for products at their reorder point.</td></tr>}
          </tbody>
        </table>
      </div>
      {!!sups?.length && (
        <form action={createManualPo} className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5">
          <div><label className="label">New manual order for</label><select name="supplier_id" className="input">{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="min-w-60 flex-1"><label className="label">Notes</label><input name="notes" className="input" /></div>
          <button className="btn btn-ghost">Create</button>
        </form>
      )}
    </div>
  );
}
