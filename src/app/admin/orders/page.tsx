import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const { status = "" } = await searchParams;
  let q = supabaseAdmin()
    .from("orders")
    .select("id, number, email, status, total, fulfillment_type, payment_provider, created_at, shipping_address")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "open") q = q.in("status", ["paid", "processing", "packed"]);
  else if (status) q = q.eq("status", status);
  const { data } = await q;
  const tabs = [["", "All"], ["open", "To fulfil"], ["pending", "Awaiting payment"], ["shipped", "Shipped"], ["ready_for_pickup", "Ready for pickup"], ["delivered", "Done"]];
  return (
    <div>
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Orders</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`?status=${k}`} className={`rounded-full px-3 py-1 text-sm ${status === k ? "bg-ink text-white" : "bg-white"}`}>{l}</Link>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="table">
          <thead><tr><th>No.</th><th>Customer</th><th>Delivery</th><th>Payment</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-green">#{o.number}</Link></td>
                <td>{(o.shipping_address as { name?: string } | null)?.name}<div className="text-xs text-muted">{o.email}</div></td>
                <td>{o.fulfillment_type}</td>
                <td>{o.payment_provider}</td>
                <td>{o.status.replace(/_/g, " ")}</td>
                <td>{money(o.total)}</td>
                <td>{new Date(o.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={7} className="py-8 text-center text-muted">No orders here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
