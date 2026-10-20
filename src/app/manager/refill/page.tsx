import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { SendPanel } from "@/app/admin/purchase-orders/[id]/send-panel";
import { Msg, Section } from "../ui";
import { refillAdd, refillMessage, refillQty } from "../actions";

export const dynamic = "force-dynamic";

type Sup = { id: number; name: string; email: string | null; whatsapp: string | null; preferred_channel: string };

export default async function Refill({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; msg?: string }> }) {
  const { s = "", q = "", msg } = await searchParams;
  const sb = supabaseAdmin();
  const supplierId = Number(s) || 0;
  const [{ data: sups }, { data: drafts }] = await Promise.all([
    sb.from("suppliers").select("id, name, email, whatsapp, preferred_channel").eq("active", true).order("name"),
    sb.from("purchase_orders").select("id, supplier_id, purchase_order_items(id)").eq("status", "draft").eq("kind", "refill"),
  ]);
  const draftCount = new Map<number, number>();
  for (const d of drafts ?? []) draftCount.set(d.supplier_id, (draftCount.get(d.supplier_id) ?? 0) + (d.purchase_order_items as unknown[]).length);
  const sup = (sups ?? []).find((x) => x.id === supplierId) as Sup | undefined;

  let po: { id: number; number: number; message: string | null } | null = null;
  let items: { id: number; product_id: number; qty: number; unit_cost: number | null; products: { title: string; sku: string; image_url: string | null; stock: number } }[] = [];
  let products: { id: number; title: string; sku: string; image_url: string | null; stock: number; reorder_point: number }[] = [];

  if (sup) {
    const { data: d } = await sb.from("purchase_orders").select("id, number, message").eq("supplier_id", sup.id).eq("status", "draft").eq("kind", "refill").order("created_at", { ascending: false }).limit(1).maybeSingle();
    po = d;
    if (po) {
      const { data: it } = await sb.from("purchase_order_items").select("id, product_id, qty, unit_cost, products(title, sku, image_url, stock)").eq("purchase_order_id", po.id).order("id");
      items = (it ?? []) as unknown as typeof items;
    }
    const term = q.trim().replace(/[%,()]/g, " ");
    let pq = sb.from("products").select("id, title, sku, image_url, stock, reorder_point").neq("status", "draft").order("stock").limit(40);
    if (term) pq = pq.or(`title.ilike.%${term}%,sku.ilike.%${term}%`);
    else {
      const { data: sp } = await sb.from("supplier_products").select("product_id").eq("supplier_id", sup.id);
      const ids = (sp ?? []).map((r) => r.product_id);
      pq = ids.length ? pq.or(`supplier_id.eq.${sup.id},id.in.(${ids.join(",")})`) : pq.eq("supplier_id", sup.id);
    }
    products = ((await pq).data ?? []) as typeof products;
  }
  const inList = new Set(items.map((i) => i.product_id));
  const units = items.reduce((t, i) => t + i.qty, 0);
  const value = items.reduce((t, i) => t + i.qty * (Number(i.unit_cost) || 0), 0);
  const keep = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="supplier_id" value={supplierId || ""} />
      <input type="hidden" name="q" value={q} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  return (
    <div>
      <Msg msg={msg} />
      <h1 className="text-base font-semibold">Order from a supplier</h1>
      <p className="mt-0.5 text-xs text-muted">Pick a supplier, add what you need, then send the list as a PDF by WhatsApp or email.</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(sups ?? []).map((x) => {
          const on = x.id === supplierId;
          const n = draftCount.get(x.id) ?? 0;
          return (
            <Link key={x.id} href={`/manager/refill?s=${x.id}`} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${on ? "mt-c mt-violet ring-2 ring-[var(--c)]" : "border border-line bg-white"}`} aria-current={on ? "true" : undefined}>
              <span data-no-translate>{x.name}</span>
              {n > 0 && <span className="ml-1.5 rounded-full bg-[#7b4fa8] px-1.5 text-[0.6875rem] text-white">{n}</span>}
            </Link>
          );
        })}
        {!sups?.length && <p className="text-sm text-muted">No suppliers yet. Add them in the admin under Suppliers.</p>}
      </div>

      {sup && (
        <>
          <Section title={`List for ${sup.name}`} action={po ? <a href={`/admin/purchase-orders/${po.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs font-medium text-forest">PDF preview</a> : undefined}>
            <div className="mt-c mt-violet rounded-2xl p-1">
              {items.length ? (
                <ul className="divide-y divide-line rounded-xl bg-white">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {i.products.image_url ? <img src={i.products.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-surface" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" data-no-translate>{i.products.title}</p>
                        <p className="text-[0.6875rem] text-muted">{i.products.stock} in stock{i.unit_cost != null ? ` · ${money(i.unit_cost)} each` : ""}</p>
                      </div>
                      <div className="flex items-center rounded-full border border-line text-sm">
                        <form action={refillQty}>{keep({ item_id: String(i.id), delta: "-1" })}<button className="h-9 w-9" aria-label={`One less ${i.products.title}`}>−</button></form>
                        <span className="w-8 text-center font-semibold tabular-nums">{i.qty}</span>
                        <form action={refillQty}>{keep({ item_id: String(i.id), delta: "1" })}<button className="h-9 w-9" aria-label={`One more ${i.products.title}`}>+</button></form>
                      </div>
                      <form action={refillQty}>{keep({ item_id: String(i.id), qty: "0" })}<button className="h-9 w-9 text-muted hover:text-terra" aria-label={`Remove ${i.products.title}`}>×</button></form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-white p-5 text-center text-sm text-muted">The list is empty. Add products below.</p>
              )}
              {items.length > 0 && (
                <p className="px-3 py-2 text-xs font-medium">
                  {items.length} products · {units} units{value > 0 ? ` · about ${money(value)}` : ""}
                </p>
              )}
            </div>
          </Section>

          {po && items.length > 0 && (
            <>
              <form action={refillMessage} className="mt-3 space-y-2">
                {keep({ po_id: String(po.id) })}
                <label className="label" htmlFor="message">Message to the supplier (optional)</label>
                <textarea id="message" name="message" rows={2} defaultValue={po.message ?? ""} className="input" placeholder="e.g. Please deliver by Friday morning." />
                <button className="btn btn-ghost h-9 px-4 py-1 text-sm">Save message</button>
              </form>
              <div className="mt-4">
                <SendPanel poId={po.id} hasEmail={!!sup.email} hasWhatsApp={!!sup.whatsapp} preferred={sup.preferred_channel} status="draft" email={sup.email} whatsapp={sup.whatsapp} />
              </div>
            </>
          )}

          <Section title={q ? `Search: ${q}` : `Products from ${sup.name}`}>
            <form className="mb-3 flex gap-2" action="/manager/refill">
              <input type="hidden" name="s" value={sup.id} />
              <input name="q" defaultValue={q} placeholder="Search any product or SKU" className="input flex-1" type="search" />
              <button className="btn btn-primary px-4">Search</button>
            </form>
            {products.length ? (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-surface" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" data-no-translate>{p.title}</p>
                      <p className="text-[0.6875rem] text-muted">
                        <b className={p.stock <= p.reorder_point ? "text-terra" : ""}>{p.stock}</b> in stock
                      </p>
                    </div>
                    <form action={refillAdd}>
                      {keep({ product_id: String(p.id) })}
                      <button className={`btn h-9 px-3 py-1 text-xs ${inList.has(p.id) ? "btn-ghost" : "btn-primary"}`}>{inList.has(p.id) ? "+1" : "+ Add"}</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">{q ? "No products found." : "No products are linked to this supplier yet. Search to add any product."}</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
