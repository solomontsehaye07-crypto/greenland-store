import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { supplierInsights } from "@/lib/purchasing";
import { Card, PageHead } from "@/components/admin/ui";
import { receivePoAction, setPoStatus } from "../../actions";
import { deleteDraftPo } from "../actions";
import { SendPanel } from "./send-panel";
import { PoEditor, type ProdInfo } from "./po-editor";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", confirmed: "Confirmed", partially_received: "Partly received", received: "Received", cancelled: "Cancelled" };

export default async function PoDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const id = Number((await params).id);
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single();
  if (!po) notFound();
  const [{ data: items }, { data: sends }, insights] = await Promise.all([
    sb.from("purchase_order_items").select("id, qty, unit_cost, note, qty_received, product_id, products(sku, title, title_de, stock, image_url, cost_price)").eq("purchase_order_id", id).order("id"),
    sb.from("purchase_order_sends").select("*").eq("purchase_order_id", id).order("sent_at", { ascending: false }),
    supplierInsights(po.supplier_id),
  ]);
  const sup = po.suppliers;
  const editable = !["received", "cancelled"].includes(po.status) && po.kind !== "dropship";
  const receivable = ["sent", "confirmed", "partially_received"].includes(po.status);
  const products: Record<number, ProdInfo> = {};
  for (const i of items ?? []) {
    const p = i.products as unknown as { sku: string; title: string; title_de: string | null; stock: number; image_url: string | null; cost_price: number | null };
    products[i.product_id] = { id: i.product_id, sku: p.sku, title: p.title_de || p.title, image_url: p.image_url, stock: p.stock, cost: p.cost_price };
  }

  return (
    <div>
      <Link href={`/admin/purchase-orders?supplier=${po.supplier_id}`} className="text-sm text-muted hover:text-ink">← Refill requests</Link>
      <div className="mt-2">
        <PageHead
          title={`PO-${po.number} · ${sup.name}`}
          text={
            <>
              {po.kind === "dropship" ? "Dropship order" : "Refill request"} · <b>{STATUS[po.status] ?? po.status}</b>
              {po.sent_at ? ` · last sent ${new Date(po.sent_at).toLocaleString("de-DE")} via ${po.sent_via}` : ""}
              {po.edited_after_send ? " · changed since it was sent" : ""}
            </>
          }
          actions={
            po.status === "draft" ? (
              <form action={deleteDraftPo}>
                <input type="hidden" name="po_id" value={po.id} />
                <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10">Cancel draft</button>
              </form>
            ) : null
          }
        />
      </div>

      <PoEditor
        poId={po.id}
        editable={editable}
        sentBefore={!!po.sent_at}
        products={products}
        insights={insights}
        initial={{
          expected_at: po.expected_at,
          notes: po.notes,
          message: po.message,
          show_prices: po.show_prices !== false,
          items: (items ?? []).map((i) => ({ id: i.id, product_id: i.product_id, qty: i.qty, unit_cost: i.unit_cost, note: i.note })),
        }}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SendPanel poId={po.id} hasEmail={!!sup.email} hasWhatsApp={!!(sup.whatsapp || sup.phone)} preferred={sup.preferred_channel} status={po.status} email={sup.email} whatsapp={sup.whatsapp || sup.phone} />

        <Card title="Archive" text="Every PDF that was sent, exactly as the supplier received it.">
          {sends?.length ? (
            <ul className="divide-y divide-line text-sm">
              {sends.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{new Date(s.sent_at).toLocaleString("de-DE")} · {s.channel === "email" ? "Email" : "WhatsApp"}{s.recipient ? ` to ${s.recipient}` : ""}</span>
                  {s.pdf_path && <a href={`/admin/purchase-orders/${po.id}/pdf?file=${encodeURIComponent(s.pdf_path)}`} target="_blank" rel="noopener" className="shrink-0 font-medium text-forest underline">PDF</a>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Not sent yet.</p>
          )}
          <form action={setPoStatus} className="mt-4 flex gap-2 border-t border-line pt-4">
            <input type="hidden" name="po_id" value={po.id} />
            <select name="status" defaultValue={po.status} className="input h-10 py-2 text-sm">
              {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn btn-ghost h-10 py-2 text-sm">Set status</button>
          </form>
        </Card>
      </div>

      {receivable && (
        <Card className="mt-5" title="Goods arrived" text="Enter what was delivered. It is added to the stock, and the purchase cost updates your average cost.">
          <form action={receivePoAction}>
            <input type="hidden" name="po_id" value={po.id} />
            <table className="table">
              <thead><tr><th>Product</th><th>Ordered</th><th>Received now</th><th>Best before</th></tr></thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.id}>
                    <td>{products[i.product_id]?.title}<div className="text-xs text-muted">{products[i.product_id]?.sku}</div></td>
                    <td>{i.qty}{i.qty_received ? <span className="text-xs text-muted"> ({i.qty_received} already)</span> : null}</td>
                    <td><input name={`recv_${i.product_id}`} type="number" min={0} defaultValue={Math.max(0, i.qty - i.qty_received)} className="input w-20 py-1" /></td>
                    <td><input name={`bb_${i.product_id}`} type="date" className="input py-1" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-primary mt-4">Add to stock</button>
          </form>
        </Card>
      )}
    </div>
  );
}
