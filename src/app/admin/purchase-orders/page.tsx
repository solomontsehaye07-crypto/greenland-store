import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { supplierInsights } from "@/lib/purchasing";
import { Card, Notice, PageHead } from "@/components/admin/ui";
import { createDrafts } from "../actions";
import { newRefillRequest } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "bg-saffron/25"],
  sent: ["Sent", "bg-indigo/10 text-indigo"],
  quoted: ["Prices received", "bg-saffron/25"],
  confirmed: ["Confirmed", "bg-indigo/10 text-indigo"],
  partially_received: ["Partly received", "bg-forest/10 text-forest"],
  received: ["Received", "bg-forest text-white"],
  cancelled: ["Cancelled", "bg-line text-muted"],
};

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "today" : d < 60 ? `${d} days ago` : `${Math.round(d / 30)} months ago`;
};

export default async function PurchaseOrders({ searchParams }: { searchParams: Promise<{ supplier?: string; status?: string; msg?: string }> }) {
  await requireStaff();
  const { supplier = "", status = "", msg } = await searchParams;
  const sb = supabaseAdmin();
  let q = sb
    .from("purchase_orders")
    .select("id, number, status, kind, created_at, sent_at, sent_via, expected_at, edited_after_send, suppliers(name), purchase_order_items(qty, unit_cost), purchase_order_sends(id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (supplier) q = q.eq("supplier_id", Number(supplier));
  if (status === "open") q = q.in("status", ["draft", "sent", "quoted", "confirmed", "partially_received"]);
  else if (status) q = q.eq("status", status);
  const [{ data: pos }, { data: sups }] = await Promise.all([q, sb.from("suppliers").select("id, name").eq("active", true).order("name")]);
  const sel = supplier ? (sups ?? []).find((s) => String(s.id) === supplier) : undefined;
  const ins = sel ? await supplierInsights(sel.id) : [];
  const most = ins.filter((i) => i.times > 0).sort((a, b) => b.times - a.times || b.qty - a.qty).slice(0, 6);
  const recent = ins.filter((i) => i.last).sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 6);
  const stale = ins.filter((i) => !i.last || Date.now() - new Date(i.last).getTime() > 45 * 86400000).sort((a, b) => String(a.last ?? "").localeCompare(String(b.last ?? ""))).slice(0, 6);
  const href = (o: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ supplier, status, ...o }).filter(([, v]) => v));
    return `/admin/purchase-orders${u.toString() ? `?${u}` : ""}`;
  };

  return (
    <div>
      <PageHead
        title="Refill requests"
        text="Orders to your suppliers as a PDF, sent by email or WhatsApp and kept in an archive. Open one to edit it with a live preview."
        actions={
          <form action={createDrafts}>
            <button className="btn btn-ghost text-sm">Draft from low stock</button>
          </form>
        }
      />
      <Notice msg={msg} />

      <Card className="mb-5" title="New refill request">
        {sups?.length ? (
          <form action={newRefillRequest} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56">
              <label className="label" htmlFor="supplier_id">Supplier</label>
              <select id="supplier_id" name="supplier_id" defaultValue={supplier} className="input">
                <option value="">Choose…</option>
                {sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary">Start request</button>
          </form>
        ) : (
          <p className="text-sm text-muted">Add your first supplier under <Link href="/admin/suppliers/new" className="text-forest underline">Suppliers</Link> to send refill requests.</p>
        )}
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2">
          <select name="supplier" defaultValue={supplier} className="input h-9 w-auto py-1 text-sm" aria-label="Filter by supplier">
            <option value="">All suppliers</option>
            {(sups ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="hidden" name="status" value={status} />
          <button className="btn btn-ghost h-9 py-1 text-sm">Show</button>
        </form>
        {[["", "All"], ["open", "Open"], ["draft", "Drafts"], ["received", "Received"]].map(([k, l]) => (
          <Link key={k} href={href({ status: k })} className={`rounded-full px-3 py-1.5 text-xs font-medium ${status === k ? "bg-ink text-white" : "hover:bg-surface"}`}>{l}</Link>
        ))}
      </div>

      {sel && (
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {[
            ["Most ordered", most, (i: (typeof ins)[number]) => `${i.times}× · ${i.qty} units`],
            ["Recently ordered", recent, (i: (typeof ins)[number]) => ago(i.last)],
            ["Not ordered for a while", stale, (i: (typeof ins)[number]) => `last: ${ago(i.last)} · stock ${i.stock}`],
          ].map(([t, list, fmt]) => (
            <Card key={t as string} title={`${t as string} · ${sel.name}`}>
              {(list as typeof ins).length ? (
                <ul className="space-y-1.5 text-sm">
                  {(list as typeof ins).map((i) => (
                    <li key={i.product_id} className="flex justify-between gap-3"><span className="truncate">{i.title}</span><span className="shrink-0 text-xs text-muted">{(fmt as (i: (typeof ins)[number]) => string)(i)}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing yet.</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="table">
          <thead><tr><th>No.</th><th>Supplier</th><th>Items</th><th>Value</th><th>Status</th><th>Created</th><th>Sent</th></tr></thead>
          <tbody>
            {(pos ?? []).map((po) => {
              const it = po.purchase_order_items as { qty: number; unit_cost: number | null }[];
              const [label, cls] = STATUS[po.status] ?? [po.status, "bg-surface"];
              return (
                <tr key={po.id}>
                  <td><Link href={`/admin/purchase-orders/${po.id}`} className="font-semibold text-forest hover:underline">PO-{po.number}</Link>{po.kind === "dropship" && <span className="ml-1 text-xs text-muted">dropship</span>}</td>
                  <td>{(po.suppliers as unknown as { name: string }).name}</td>
                  <td>{it.length} · {it.reduce((s, i) => s + i.qty, 0)} units</td>
                  <td>{money(it.reduce((s, i) => s + (Number(i.unit_cost) || 0) * i.qty, 0))}</td>
                  <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>{po.edited_after_send ? <span className="ml-1 text-xs text-terra">changed</span> : null}</td>
                  <td>{new Date(po.created_at).toLocaleDateString("de-DE")}</td>
                  <td className="text-xs">{po.sent_at ? `${new Date(po.sent_at).toLocaleDateString("de-DE")} · ${po.sent_via}${(po.purchase_order_sends as unknown[]).length > 1 ? ` (${(po.purchase_order_sends as unknown[]).length}×)` : ""}` : "—"}</td>
                </tr>
              );
            })}
            {!pos?.length && <tr><td colSpan={7} className="py-8 text-center text-muted">No refill requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
