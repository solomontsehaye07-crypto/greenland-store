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
    .select("number, status, total, shipping_total, fulfillment_type, order_items(title, qty, unit_price), shipping_methods(name)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 pt-14">
      <ClearCart />
      <h1 className="text-4xl font-extrabold">Thank you! Order #{o.number}</h1>
      <p className="mt-3 text-lg text-green">{STATUS[o.status] ?? o.status}</p>
      <p className="mt-2 text-muted">We sent a confirmation to your email. Questions? Message us on WhatsApp at 0152 13945662.</p>
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
      <Link href="/" className="btn btn-ghost mt-8">Continue shopping</Link>
    </div>
  );
}
