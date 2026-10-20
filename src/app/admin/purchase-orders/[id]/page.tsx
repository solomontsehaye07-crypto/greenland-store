import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { addPoItem, receivePoAction, regeneratePdf, setPoStatus, updatePoItem } from "../../actions";
import { SendPanel } from "./send-panel";

export default async function PoDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const id = Number((await params).id);
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single();
  if (!po) notFound();
  const { data: items } = await sb
    .from("purchase_order_items")
    .select("id, qty, unit_cost, qty_received, product_id, products(sku, title, stock)")
    .eq("purchase_order_id", id)
    .order("id");
  const sup = po.suppliers;
  const total = (items ?? []).reduce((s, i) => s + (Number(i.unit_cost) || 0) * i.qty, 0);
  const editable = po.status === "draft";
  const receivable = ["sent", "confirmed", "partially_received"].includes(po.status);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/purchase-orders" className="text-sm text-green">← Refill orders</Link>
        <h1 className="display mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">PO-{po.number} · {sup.name}</h1>
        <p className="text-sm text-muted">
          {po.kind === "dropship" ? "Dropship order" : "Refill order"} · status {po.status.replace("_", " ")}
          {po.sent_at ? ` · sent ${new Date(po.sent_at).toLocaleString("de-DE")} via ${po.sent_via}` : ""}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-[0.9375rem] font-semibold">Items</h2>
          <form action={receivable ? receivePoAction : undefined}>
            <input type="hidden" name="po_id" value={po.id} />
            <table className="table mt-3">
              <thead><tr><th>Product</th><th>In stock</th><th>Qty</th><th>Unit cost</th>{receivable && <><th>Received now</th><th>Best before</th></>}</tr></thead>
              <tbody>
                {(items ?? []).map((i) => {
                  const p = i.products as unknown as { sku: string; title: string; stock: number };
                  return (
                    <tr key={i.id}>
                      <td>{p.title}<div className="text-xs text-muted">{p.sku}</div></td>
                      <td>{p.stock}</td>
                      <td>
                        {editable ? (
                          <span className="flex gap-1">
                            <input form={`f${i.id}`} name="qty" type="number" defaultValue={i.qty} className="input w-20 py-1" />
                          </span>
                        ) : (
                          <>{i.qty}{i.qty_received ? <span className="text-xs text-muted"> ({i.qty_received} recv.)</span> : null}</>
                        )}
                      </td>
                      <td>
                        {editable ? (
                          <span className="flex items-center gap-2">
                            <input form={`f${i.id}`} name="unit_cost" type="number" step="0.01" defaultValue={i.unit_cost ?? ""} className="input w-24 py-1" />
                            <button form={`f${i.id}`} className="text-sm text-green underline">Save</button>
                          </span>
                        ) : i.unit_cost ? money(i.unit_cost) : "—"}
                      </td>
                      {receivable && (
                        <>
                          <td><input name={`recv_${i.product_id}`} type="number" min={0} defaultValue={Math.max(0, i.qty - i.qty_received)} className="input w-20 py-1" /></td>
                          <td><input name={`bb_${i.product_id}`} type="date" className="input py-1" /></td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {receivable && <button className="btn btn-primary mt-4">Book received goods into stock</button>}
          </form>
          {editable &&
            (items ?? []).map((i) => (
              <form key={i.id} id={`f${i.id}`} action={updatePoItem} className="hidden">
                <input type="hidden" name="item_id" value={i.id} />
                <input type="hidden" name="po_id" value={po.id} />
              </form>
            ))}
          {editable && (
            <>
              <p className="mt-2 text-xs text-muted">Change a quantity or cost and press Save. Set the quantity to 0 to remove a line.</p>
              <form action={addPoItem} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="po_id" value={po.id} />
                <input name="sku" placeholder="Add SKU, e.g. GRL-000123" required className="input max-w-xs" />
                <input name="qty" type="number" defaultValue={6} className="input w-24" />
                <button className="btn btn-ghost">Add line</button>
              </form>
            </>
          )}
          <p className="mt-4 text-right font-semibold">Estimated total (net): {money(total)}</p>
        </section>

        <div className="space-y-6">
          <SendPanel poId={po.id} hasEmail={!!sup.email} hasWhatsApp={!!(sup.whatsapp || sup.phone)} preferred={sup.preferred_channel} status={po.status} />
          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="text-lg font-bold">PDF & status</h2>
            <form action={regeneratePdf} className="mt-3">
              <input type="hidden" name="po_id" value={po.id} />
              <button className="btn btn-ghost w-full">Open PDF</button>
            </form>
            <form action={setPoStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="po_id" value={po.id} />
              <select name="status" defaultValue={po.status} className="input">
                {["draft", "sent", "confirmed", "partially_received", "received", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
              <button className="btn btn-ghost">Set</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
