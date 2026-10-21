import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { storeInfo } from "@/lib/purchasing";
import { submitOffer } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Price request / Preisanfrage", robots: { index: false, follow: false } };

// Public page for the supplier: the long random link is the key. Shows only what we want and how many –
// never our own costs or selling prices.
export default async function OfferForSupplier({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; err?: string }> }) {
  const { token } = await params;
  const { done, err } = await searchParams;
  if (!/^[a-f0-9]{32,64}$/.test(token)) notFound();
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("id, number, status, request_kind, offer_note, offer_by, suppliers(id, name, contact_name)").eq("offer_token", token).maybeSingle();
  if (!po) notFound();
  const store = await storeInfo();
  const sup = po.suppliers as unknown as { id: number; name: string; contact_name: string | null };
  const open = po.request_kind === "quote" && ["sent", "quoted", "draft"].includes(po.status);
  const { data: items } = await sb.from("purchase_order_items").select("product_id, qty, offer_price, offer_available, offer_note, products(sku, title, title_de)").eq("purchase_order_id", po.id).order("id");
  const { data: refs } = await sb.from("supplier_products").select("product_id, supplier_sku").eq("supplier_id", sup.id);
  const ref = new Map((refs ?? []).map((r) => [r.product_id, r.supplier_sku]));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" style={{ fontSize: 16 }}>
      <p className="text-sm font-semibold text-forest">{store.name}</p>
      <h1 className="mt-1 text-2xl font-bold">Price request PR-{po.number}</h1>
      <p className="text-base text-muted">Preisanfrage PR-{po.number}</p>
      <p className="mt-4 rounded-2xl bg-surface p-4 text-[0.9375rem] leading-relaxed">
        Hello {sup.contact_name ?? sup.name}, this is not an order yet. Please enter your best <b>net price per unit</b> for each product and tick the ones you can’t deliver. We order after we see your prices.
        <br />
        <span className="text-muted">Dies ist noch keine Bestellung. Bitte tragen Sie Ihren besten <b>Netto-Stückpreis</b> ein und markieren Sie, was nicht lieferbar ist.</span>
      </p>

      {done && (
        <p className="mt-4 rounded-2xl border-2 border-forest bg-white p-4 font-semibold text-forest" role="status">
          Thank you – your prices were sent to {store.name}. You can still change them here. / Danke – Ihre Preise wurden übermittelt.
        </p>
      )}
      {err && <p className="mt-4 rounded-2xl border-2 border-terra bg-white p-4 text-terra" role="alert">{err}</p>}

      {!open ? (
        <p className="mt-6 rounded-2xl border border-line bg-white p-5">This price request is closed. / Diese Anfrage ist abgeschlossen.</p>
      ) : (
        <form action={submitOffer} className="mt-6 space-y-3">
          <input type="hidden" name="token" value={token} />
          {(items ?? []).map((i) => {
            const p = i.products as unknown as { sku: string; title: string; title_de: string | null };
            const r = ref.get(i.product_id);
            return (
              <fieldset key={i.product_id} className="rounded-2xl border-2 border-line bg-white p-4">
                <input type="hidden" name={`pid_${i.product_id}`} value="1" />
                <legend className="sr-only">{p.title}</legend>
                <p className="font-semibold leading-snug">{p.title_de || p.title}</p>
                <p className="text-sm text-muted">
                  Quantity / Menge: <b className="text-ink">{i.qty}</b> · SKU {p.sku}
                  {r ? ` · your ref ${r}` : ""}
                </p>
                <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                  <div>
                    <label className="label" htmlFor={`p-${i.product_id}`}>Net price per unit / Netto-Stückpreis (€)</label>
                    <input id={`p-${i.product_id}`} name={`price_${i.product_id}`} defaultValue={i.offer_price != null ? String(i.offer_price).replace(".", ",") : ""} inputMode="decimal" placeholder="0,00" className="input text-lg font-bold" />
                  </div>
                  <label className="flex min-h-11 items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name={`na_${i.product_id}`} defaultChecked={i.offer_available === false} className="h-5 w-5" />
                    Not available
                  </label>
                </div>
                <input name={`note_${i.product_id}`} defaultValue={i.offer_note ?? ""} placeholder="Note, e.g. pack size, best before / Hinweis" aria-label="Note" className="input mt-2 text-sm" />
              </fieldset>
            );
          })}
          <div className="rounded-2xl border-2 border-line bg-white p-4">
            <label className="label" htmlFor="note">Message for us / Nachricht (delivery time, minimum order …)</label>
            <textarea id="note" name="note" rows={3} defaultValue={po.offer_note ?? ""} className="input" />
            <label className="label mt-3" htmlFor="by">Your name / Ihr Name</label>
            <input id="by" name="by" defaultValue={po.offer_by ?? ""} autoComplete="name" className="input" />
          </div>
          <button className="btn btn-primary min-h-14 w-full text-lg">Send prices / Preise senden</button>
          <p className="text-center text-xs text-muted">{store.name} · {store.phone}{store.email ? ` · ${store.email}` : ""}</p>
        </form>
      )}
    </main>
  );
}
