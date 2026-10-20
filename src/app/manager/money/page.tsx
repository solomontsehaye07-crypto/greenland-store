import Link from "next/link";
import { computePnlSeries, monthRange } from "@/lib/finance";
import { money } from "@/lib/format";
import { Section, Tile } from "../ui";

export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "–" : `${x.toFixed(1).replace(".", ",")} %`);

export default async function Money() {
  const cur = monthRange();
  const prev = monthRange(new Date(Date.UTC(cur.from.getUTCFullYear(), cur.from.getUTCMonth() - 1, 1)).toISOString().slice(0, 7));
  const [p, q] = await computePnlSeries([cur, prev]);
  const delta = q.revenue > 0 ? ((p.revenue - q.revenue) / q.revenue) * 100 : null;
  const label = cur.from.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div>
      <p className="mb-3 text-sm text-muted" data-no-translate>{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Sales (net)" value={money(p.revenue)} sub={delta === null ? "first month" : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} % vs last month`} color="green" icon="chart" />
        <Tile label="Gross profit" value={money(p.grossProfit)} sub={`margin ${pct(p.grossMargin)}`} color="teal" icon="tag" />
        <Tile label="Thrown away / lost" value={money(p.writeoffs)} sub={`loss rate ${pct(p.lossRate)} of goods bought`} color="red" icon="box" />
        <Tile label="Net profit" value={money(p.netProfit)} sub={`after ${money(p.expenses)} costs`} color={p.netProfit >= 0 ? "blue" : "red"} icon="sparkle" />
      </div>
      <Section title="Where the money came from">
        <div className="rounded-2xl border border-line bg-white p-4 text-sm">
          <div className="flex justify-between py-1"><span>Online shop</span><b className="tabular-nums">{money(p.revenueOnline)}</b></div>
          <div className="flex justify-between py-1"><span>Shop till</span><b className="tabular-nums">{money(p.revenueStore)}</b></div>
          <div className="flex justify-between py-1"><span>Goods bought</span><b className="tabular-nums">{money(p.purchases)}</b></div>
          <div className="flex justify-between py-1"><span>Orders</span><b className="tabular-nums">{p.orders}</b></div>
        </div>
      </Section>
      {!!p.topLosses.length && (
        <Section title="Most thrown away">
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white text-sm">
            {p.topLosses.slice(0, 5).map((l) => (
              <li key={l.product_id} className="flex justify-between gap-3 px-4 py-2.5"><span className="truncate" data-no-translate>{l.title}</span><span className="shrink-0 tabular-nums">{l.qty} × · {money(l.value)}</span></li>
            ))}
          </ul>
        </Section>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Link href="/admin/finance" className="rounded-2xl border border-line bg-white px-4 py-3 font-medium hover:border-forest">Full profit & loss</Link>
        <Link href="/admin/reports" className="rounded-2xl border border-line bg-white px-4 py-3 font-medium hover:border-forest">Reports for the tax advisor</Link>
      </div>
    </div>
  );
}
