import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { offerLink } from "@/lib/purchasing";
import { SendPanel } from "@/app/admin/purchase-orders/[id]/send-panel";
import { Msg } from "../../../../ui";
import { SharePanel } from "../../share-panel";
import { CopyButton } from "../../copy-button";
import { cancelRequestAction, reopenOfferAction } from "../../../../actions";
import { OfferForm, type OfferLine } from "./offer-form";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "");

// One price request: waiting for prices → prices in → accept → send the order.
export default async function OfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const id = Number((await params).id);
  const { msg } = await searchParams;
  const sb = supabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, number, status, request_kind, offer_token, quoted_at, offer_note, offer_by, sent_at, suppliers(id, name, email, whatsapp, phone, preferred_channel)")
    .eq("id", id)
    .single();
  if (!po) notFound();
  const sup = po.suppliers as unknown as { id: number; name: string; email: string | null; whatsapp: string | null; phone: string | null; preferred_channel: string };
  const { data: items } = await sb
    .from("purchase_order_items")
    .select("id, qty, offer_price, offer_available, offer_note, ordered, products(title, price, cost_price, tax_rate)")
    .eq("purchase_order_id", id)
    .order("id");
  const lines: OfferLine[] = (items ?? []).map((i) => {
    const p = i.products as unknown as { title: string; price: number | null; cost_price: number | null; tax_rate: number | null };
    return {
      id: i.id,
      title: p.title,
      qty: i.qty,
      offer: i.offer_price != null ? Number(i.offer_price) : null,
      available: i.offer_available,
      note: i.offer_note,
      ordered: i.ordered,
      lastCost: p.cost_price != null ? Number(p.cost_price) : null,
      sell: p.price != null ? Number(p.price) : null,
      tax: Number(p.tax_rate ?? 7),
    };
  });

  const quote = po.request_kind === "quote";
  const accepted = !quote && po.status === "quoted";
  const ordered = !quote && !["draft", "quoted"].includes(po.status);
  const closed = ["cancelled", "received"].includes(po.status);
  const code = `${quote ? "PR" : "PO"}-${po.number}`;
  const stage = closed
    ? po.status === "cancelled" ? ["Cancelled", "bg-surface text-muted"] : ["Received", "mt-c mt-stock"]
    : ordered ? ["Ordered", "mt-c mt-stock"]
    : accepted ? ["Offer accepted – send the order", "mt-c mt-order"]
    : po.status === "quoted" ? ["Prices received", "mt-c mt-money"]
    : po.status === "sent" ? ["Waiting for prices", "mt-c mt-wait"]
    : ["Not sent yet", "bg-surface text-ink"];
  const link = offerLink(po.offer_token);
  const back = `/manager/orders/suppliers/offer/${id}`;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link href="/manager/orders/suppliers" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-line bg-white text-xl" aria-label="Back to suppliers">‹</Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold" data-no-translate>{sup.name}</h1>
          <p className="text-xs text-muted">{code}{po.sent_at ? ` · asked ${fmt(po.sent_at)}` : ""}</p>
        </div>
      </div>
      <p className={`rounded-2xl px-4 py-3 text-base font-bold ${stage[1]}`}>{stage[0]}</p>
      <Msg msg={msg} />

      {quote && po.status === "sent" && (
        <section className="rounded-2xl border-2 border-line bg-white p-4 text-sm">
          <p>{sup.name} can type the prices on their link. When they do, the prices appear here and you get an email.</p>
          <p className="mt-2">If they answer by WhatsApp or phone instead, type the prices below yourself.</p>
          {link && (
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="input min-w-0 flex-1 text-xs" aria-label="Link for the supplier" data-no-memory />
              <CopyButton text={link} />
            </div>
          )}
        </section>
      )}
      {po.status === "quoted" && (po.offer_by || po.offer_note) && (
        <section className="rounded-2xl border-2 border-line bg-white p-4 text-sm">
          <p className="font-semibold">Prices {po.offer_by === "entered in the shop" ? "entered in the shop" : `from ${po.offer_by ?? sup.name}`} · {fmt(po.quoted_at)}</p>
          {po.offer_note && <p className="mt-1" data-no-translate>“{po.offer_note}”</p>}
        </section>
      )}

      <OfferForm poId={id} lines={lines} locked={!quote || closed} />

      {accepted && (
        <>
          <SendPanel poId={id} hasEmail={!!sup.email} hasWhatsApp={!!(sup.whatsapp || sup.phone)} preferred={sup.preferred_channel} status={po.status} email={sup.email} whatsapp={sup.whatsapp || sup.phone} />
          <form action={reopenOfferAction}>
            <input type="hidden" name="po_id" value={id} />
            <button className="w-full py-2 text-sm font-semibold text-muted underline">Change the offer again</button>
          </form>
        </>
      )}
      {quote && po.status === "sent" && (
        <SendPanel poId={id} hasEmail={!!sup.email} hasWhatsApp={!!(sup.whatsapp || sup.phone)} preferred={sup.preferred_channel} status={po.status} email={sup.email} whatsapp={sup.whatsapp || sup.phone} quote />
      )}

      <Link href={`/manager/orders/suppliers/pdf/${id}?back=${encodeURIComponent(back)}`} className="btn btn-ghost w-full font-semibold">See the PDF</Link>
      {!closed && <SharePanel poId={id} what={po.status === "quoted" ? "the offer" : quote ? "the price request" : "the order"} />}
      {!closed && !ordered && (
        <form action={cancelRequestAction}>
          <input type="hidden" name="po_id" value={id} />
          <button className="w-full py-3 text-sm font-semibold text-terra underline">Cancel this request</button>
        </form>
      )}
    </div>
  );
}
