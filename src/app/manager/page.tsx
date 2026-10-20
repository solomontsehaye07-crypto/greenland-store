import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { berlinDayStart, berlinToday } from "@/lib/designs";
import { Msg, Section, Tile } from "./ui";
import { tillTotal } from "./actions";

export const dynamic = "force-dynamic";

const OPEN = ["paid", "processing", "packed", "ready_for_pickup"];

export default async function Today({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const sb = supabaseAdmin();
  const today = berlinToday();
  const start = berlinDayStart(today);
  const startIso = start.toISOString();
  const end = new Date(start.getTime() + 86400000).toISOString();
  const [{ data: paidToday }, { data: till }, { data: open }, { data: pickups }, { count: low }, { count: expiring }, { count: drafts }, { data: due }] = await Promise.all([
    sb.from("orders").select("total").gte("paid_at", startIso).lt("paid_at", end).in("status", [...OPEN, "shipped", "delivered"]),
    sb.from("store_sales").select("gross_7, gross_19").eq("day", today),
    sb.from("orders").select("status").in("status", OPEN),
    sb.from("orders").select("id, number, pickup_slot, pickup_at, status, balance_due, shipping_address").gte("pickup_at", startIso).lt("pickup_at", end).not("status", "in", "(cancelled,refunded,delivered)").order("pickup_at"),
    sb.from("low_stock").select("id", { count: "exact", head: true }),
    sb.from("expiring_batches").select("id", { count: "exact", head: true }),
    sb.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "draft"),
    sb.from("orders").select("balance_due").gt("balance_due", 0).not("status", "in", "(cancelled,refunded)"),
  ]);
  const online = (paidToday ?? []).reduce((s, o) => s + Number(o.total), 0);
  const store = (till ?? []).reduce((s, t) => s + Number(t.gross_7) + Number(t.gross_19), 0);
  const count = (s: string) => (open ?? []).filter((o) => o.status === s).length;
  const toPack = count("paid") + count("processing");
  const balance = (due ?? []).reduce((s, o) => s + Number(o.balance_due), 0);

  return (
    <div>
      <Msg msg={msg} />
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Sales today" value={money(online + store)} sub={`Online ${money(online)} · Till ${money(store)}`} tone="good" href="/manager/money" />
        <Tile label="Orders to pack" value={toPack} sub={`${count("packed")} packed · ${count("ready_for_pickup")} waiting for pickup`} tone={toPack ? "warn" : undefined} href="/manager/orders" />
        <Tile label="Pickups today" value={pickups?.length ?? 0} sub={pickups?.[0]?.pickup_slot ? `next: ${String(pickups[0].pickup_slot).split("·").pop()?.trim()}` : "none booked"} href="/manager/orders" />
        <Tile label="Running low" value={low ?? 0} sub={`${expiring ?? 0} batches expire soon · ${drafts ?? 0} refill drafts`} tone={(low ?? 0) > 0 ? "bad" : undefined} href="/manager/stock" />
      </div>
      {balance > 0 && <p className="mt-3 rounded-xl border border-saffron bg-saffron/10 px-4 py-3 text-sm">Still to collect on pickup or delivery: <b>{money(balance)}</b></p>}

      {!!pickups?.length && (
        <Section title="Pickups today" action={<Link href="/manager/orders" className="text-xs font-medium text-forest">All orders</Link>}>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {pickups.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span><b>#{o.number}</b> <span data-no-translate>{(o.shipping_address as { name?: string } | null)?.name ?? ""}</span></span>
                <span className="text-right text-xs text-muted">{o.pickup_slot}{Number(o.balance_due) > 0 ? <><br />{money(o.balance_due)} to pay</> : null}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Till total for today">
        <form action={tillTotal} className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4">
          <input type="hidden" name="day" value={today} />
          <div><label className="label" htmlFor="g7">7 % (food), €</label><input id="g7" name="gross_7" inputMode="decimal" className="input" /></div>
          <div><label className="label" htmlFor="g19">19 %, €</label><input id="g19" name="gross_19" inputMode="decimal" className="input" /></div>
          <button className="btn btn-primary col-span-2">Save till total</button>
          {store > 0 && <p className="col-span-2 text-xs text-muted">Already saved today: {money(store)}</p>}
        </form>
      </Section>

      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["/admin/goods-in", "Book a delivery"],
            ["/admin/finance", "Book spoiled or stolen items"],
            ["/admin/purchase-orders", "Refill requests"],
            ["/admin/products?new=1", "New product"],
            ["/admin/reports", "Reports for the tax advisor"],
            ["/admin/products?filter=offer", "Offers"],
          ].map(([h, l]) => (
            <Link key={h} href={h} className="rounded-2xl border border-line bg-white px-4 py-3 font-medium hover:border-forest">{l}</Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
