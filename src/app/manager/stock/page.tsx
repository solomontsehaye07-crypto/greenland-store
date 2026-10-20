import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { Msg, Section } from "../ui";
import { addToRefill } from "../actions";

export const dynamic = "force-dynamic";

export default async function Stock({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data: low }, { data: exp }, { data: drafts }] = await Promise.all([
    sb.from("low_stock").select("id, sku, title, stock, reorder_point, supplier_name, on_order, image_url").order("stock").limit(60),
    sb.from("expiring_batches").select("id, product_id, title, best_before, quantity_left").order("best_before").limit(30),
    sb.from("purchase_orders").select("id, number, suppliers(name), purchase_order_items(qty)").eq("status", "draft").order("created_at", { ascending: false }),
  ]);
  return (
    <div>
      <Msg msg={msg} />
      {!!drafts?.length && (
        <Section title="Refill requests ready to send">
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/purchase-orders/${d.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface">
                  <span><b>PO-{d.number}</b> · {(d.suppliers as unknown as { name: string }).name}</span>
                  <span className="text-xs text-muted">{(d.purchase_order_items as unknown[]).length} items → open & send</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`Running low (${low?.length ?? 0})`} action={<Link href="/admin/goods-in" className="text-xs font-medium text-forest">Book a delivery</Link>}>
        {low?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {low.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-surface" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" data-no-translate>{p.title}</p>
                  <p className="text-xs text-muted"><b className={p.stock <= 0 ? "text-terra" : ""}>{p.stock}</b> left · reorder at {p.reorder_point}{p.supplier_name ? ` · ${p.supplier_name}` : ""}</p>
                </div>
                {p.on_order ? (
                  <span className="text-xs font-medium text-forest">On order</span>
                ) : (
                  <form action={addToRefill}>
                    <input type="hidden" name="product_id" value={p.id} />
                    <button className="btn btn-ghost h-8 px-3 py-1 text-xs">+ Refill</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">Nothing is running low.</p>
        )}
      </Section>
      <Section title="Expiring within 30 days">
        {exp?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {exp.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate" data-no-translate>{b.title}</span>
                <span className="shrink-0 text-xs text-muted">{b.quantity_left} × {new Date(b.best_before).toLocaleDateString("de-DE")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">No batches expire in the next 30 days.</p>
        )}
        <p className="mt-2 text-xs text-muted">Put soon-expiring products on offer in Products to sell them in time.</p>
      </Section>
    </div>
  );
}
