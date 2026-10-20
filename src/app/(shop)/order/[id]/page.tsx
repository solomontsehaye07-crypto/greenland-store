import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { ClearCart } from "./clear-cart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmation", robots: { index: false } };

const STATUS: Record<string, string> = {
  pending: "Waiting for payment confirmation",
  paid: "Paid – we are packing your order",
  processing: "Confirmed – pay on pickup / delivery",
  packed: "Packed",
  shipped: "On its way",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // UUIDs are unguessable; we only show a minimal summary
  const { data: o } = await supabaseAdmin()
    .from("orders")
    .select("id, number, status, total, shipping_total, fulfillment_type, payment_method, deposit_amount, balance_due, pickup_slot, paid_at, order_items(title, qty, unit_price), shipping_methods(name)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const { data: st } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.store", "public.payments", "public.site"]);
  const get = (k: string) => ((st ?? []).find((r) => r.key === k)?.value ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const phone = get("public.site").phone || get("public.store").phone;
  const bank = get("public.payments").bank as { holder?: string; iban?: string; bic?: string; bankName?: string; days?: number } | undefined;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-14">
      <ClearCart />
      <h1 className="display text-3xl font-semibold tracking-tight sm:text-4xl">Thank you! Order #{o.number}</h1>
      <p className="mt-3 text-lg text-green">{STATUS[o.status] ?? o.status}</p>
      <p className="mt-2 text-muted">We sent a confirmation and your receipt to your email.{phone ? ` Questions? Message us on WhatsApp at ${phone}.` : ""}</p>
      {o.pickup_slot && <p className="mt-4 rounded-2xl bg-white px-5 py-3 text-sm">Pickup: <b>{o.pickup_slot}</b></p>}
      {o.payment_method === "bank" && !o.paid_at && bank?.iban && (
        <div className="mt-4 rounded-2xl border border-saffron bg-saffron/10 px-5 py-4 text-sm">
          <p className="font-semibold">Please transfer {money(o.total)} within {bank.days ?? 7} days</p>
          <p className="mt-1">{bank.holder}<br />IBAN {bank.iban}{bank.bic ? <><br />BIC {bank.bic}</> : null}{bank.bankName ? <><br />{bank.bankName}</> : null}<br />Reference: <b>Order {o.number}</b></p>
        </div>
      )}
      {Number(o.balance_due) > 0 && o.payment_method !== "bank" && (
        <p className="mt-4 rounded-2xl border border-saffron bg-saffron/10 px-5 py-3 text-sm">
          {o.deposit_amount ? <>Deposit paid: <b>{money(o.deposit_amount)}</b> · </> : null}To pay on collection: <b>{money(o.balance_due)}</b>
        </p>
      )}
      <ul className="mt-8 divide-y divide-line rounded-3xl bg-white px-5">
        {(o.order_items as { title: string; qty: number; unit_price: number }[]).map((i, n) => (
          <li key={n} className="flex justify-between gap-4 py-3 text-sm">
            <span>{i.qty} × {i.title}</span>
            <span>{money(i.qty * i.unit_price)}</span>
          </li>
        ))}
        <li className="flex justify-between py-3 text-sm">
          <span>{(o.shipping_methods as unknown as { name: string } | null)?.name}</span>
          <span>{money(o.shipping_total)}</span>
        </li>
        <li className="flex justify-between py-3 font-bold">
          <span>Total</span>
          <span>{money(o.total)}</span>
        </li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`/order/${o.id}/receipt`} target="_blank" rel="noopener" className="btn btn-primary">Download receipt (PDF)</a>
        <Link href="/" className="btn btn-ghost">Continue shopping</Link>
      </div>
    </div>
  );
}
