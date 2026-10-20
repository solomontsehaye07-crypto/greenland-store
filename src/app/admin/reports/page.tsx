import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { buildReport, REASON_DE } from "@/lib/reports";
import { Card, Notice, PageHead } from "@/components/admin/ui";
import { resolvePeriod } from "./period";
import { sendReport } from "./actions";

export const dynamic = "force-dynamic";

const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export default async function Reports({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string; msg?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const per = resolvePeriod(sp.p, sp.from, sp.to);
  const [r, { data: acc }] = await Promise.all([buildReport(per.from, per.to), supabaseAdmin().from("settings").select("value").eq("key", "private.accounting").maybeSingle()]);
  const advisor = (acc?.value as { advisorEmail?: string } | null)?.advisorEmail ?? "";
  const q = per.key === "custom" ? `from=${per.from}&to=${per.to}` : `p=${per.key}`;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const curQ = Math.ceil(m / 3);
  const prevQ = curQ === 1 ? `${y - 1}-Q4` : `${y}-Q${curQ - 1}`;
  const quick: [string, string][] = [
    [`${y}-${String(m).padStart(2, "0")}`, "This month"],
    [prevM, "Last month"],
    [`${y}-Q${curQ}`, "This quarter"],
    [prevQ, "Last quarter"],
    [String(y), "This year"],
    [String(y - 1), "Last year"],
  ];
  const T = r.salesTotal;
  const lossTotal = r.lossesByReason.reduce((s, x) => s + x.value, 0);

  return (
    <div>
      <PageHead
        title="Reports"
        text="Everything your bookkeeping and tax advisor (Steuerberater) need for a period: sales by VAT rate, goods received, losses (spoiled, damaged, expired, stolen), own use and running costs. Download as PDF and Excel-ready CSV, or email it directly."
      />
      <Notice msg={sp.msg} />

      <Card className="mb-5" title={`Period: ${per.label}`} text={`${de(per.from)} – ${de(per.to)}`}>
        <div className="flex flex-wrap items-end gap-2">
          {quick.map(([k, l]) => (
            <Link key={k} href={`/admin/reports?p=${k}`} className={`rounded-full px-3 py-1.5 text-xs font-medium ${per.key === k ? "bg-ink text-white" : "border border-line hover:bg-surface"}`}>{l}</Link>
          ))}
          <form className="ml-auto flex flex-wrap items-end gap-2">
            <div><label className="label" htmlFor="r-from">From</label><input id="r-from" name="from" type="date" defaultValue={per.from} className="input h-9 py-1 text-sm" /></div>
            <div><label className="label" htmlFor="r-to">To</label><input id="r-to" name="to" type="date" defaultValue={per.to} className="input h-9 py-1 text-sm" /></div>
            <button className="btn btn-ghost h-9 py-1 text-sm">Show</button>
          </form>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Sales (gross)", money(T.gross), `Online ${money(T.online)} · Shop till ${money(T.store)}`],
          ["VAT owed", money(T.vat7 + T.vat19), `7 %: ${money(T.vat7)} · 19 %: ${money(T.vat19)}`],
          ["Stock losses (at cost)", money(lossTotal), r.lossesByReason.map((l) => `${REASON_DE[l.reason]} ${money(l.value)}`).join(" · ") || "none"],
          ["Goods received (net)", money(r.purchasesTotal), `${r.purchases.length} deliveries lines`],
        ].map(([t, v, sub]) => (
          <div key={t} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-muted">{t}</p>
            <p className="display mt-1 text-2xl font-semibold">{v}</p>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title="Sales by VAT rate" text="Online orders by payment date, plus the daily till totals you enter under Profit & loss." actions={<a href={`/admin/reports/export?${q}&format=csv&part=sales`} className="text-xs font-medium text-forest underline">CSV</a>}>
            <table className="table">
              <thead><tr><th></th><th className="text-right">Net</th><th className="text-right">VAT</th><th className="text-right">Gross</th></tr></thead>
              <tbody>
                <tr><td>7 % (food)</td><td className="text-right">{money(T.net7)}</td><td className="text-right">{money(T.vat7)}</td><td className="text-right">{money(T.net7 + T.vat7)}</td></tr>
                <tr><td>19 %</td><td className="text-right">{money(T.net19)}</td><td className="text-right">{money(T.vat19)}</td><td className="text-right">{money(T.net19 + T.vat19)}</td></tr>
                <tr className="font-semibold"><td>Total</td><td className="text-right">{money(T.net7 + T.net19)}</td><td className="text-right">{money(T.vat7 + T.vat19)}</td><td className="text-right">{money(T.gross)}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">{r.sales.length} entries in the period. The CSV lists every order and till day.</p>
          </Card>

          <Card title="Stock losses & own use" text="Booked under Profit & loss or in a product’s stock panel. Valued at purchase cost." actions={<a href={`/admin/reports/export?${q}&format=csv&part=losses`} className="text-xs font-medium text-forest underline">CSV</a>}>
            {r.losses.length || r.ownUse.length ? (
              <table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {[...r.losses, ...r.ownUse].slice(0, 60).map((x, i) => (
                    <tr key={i}><td>{de(x.date)}</td><td>{REASON_DE[x.reason]}</td><td className="max-w-56 truncate">{x.title}</td><td className="text-right">{x.qty}</td><td className="text-right">{x.value == null ? "no cost" : money(x.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">No losses booked in this period. Book thrown-away, damaged or stolen items under <Link href="/admin/finance" className="text-forest underline">Profit & loss</Link>.</p>
            )}
            {r.unvalued > 0 && <p className="mt-2 text-xs text-terra">{r.unvalued} lines have no purchase cost, so they are not valued. Add costs in Products or Pricing.</p>}
          </Card>

          <Card title="Goods received & running costs" actions={<span className="flex gap-3"><a href={`/admin/reports/export?${q}&format=csv&part=purchases`} className="text-xs font-medium text-forest underline">Goods CSV</a><a href={`/admin/reports/export?${q}&format=csv&part=expenses`} className="text-xs font-medium text-forest underline">Costs CSV</a></span>}>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="font-medium">Goods received: {money(r.purchasesTotal)}</p>
                <p className="text-xs text-muted">{r.purchases.reduce((s, x) => s + x.qty, 0)} items in {r.purchases.length} lines</p>
              </div>
              <div>
                <p className="font-medium">Running costs: {money(r.expensesTotal)}</p>
                <ul className="mt-1 text-xs text-muted">{r.expensesByCategory.map((e) => <li key={e.category}>{e.category}: {money(e.amount)}</li>)}</ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Download">
            <div className="grid gap-2">
              <a href={`/admin/reports/export?${q}&format=pdf`} target="_blank" rel="noopener" className="btn btn-primary">Report as PDF</a>
              <a href={`/admin/reports/export?${q}&format=csv&part=sales`} className="btn btn-ghost">Sales (CSV)</a>
              <a href={`/admin/reports/export?${q}&format=csv&part=losses`} className="btn btn-ghost">Losses & own use (CSV)</a>
              <a href={`/admin/reports/export?${q}&format=csv&part=purchases`} className="btn btn-ghost">Goods received (CSV)</a>
              <a href={`/admin/reports/export?${q}&format=csv&part=expenses`} className="btn btn-ghost">Running costs (CSV)</a>
            </div>
            <p className="mt-2 text-xs text-muted">CSV files use semicolons and German number format, so they open directly in Excel and can be imported into DATEV.</p>
          </Card>
          <Card title="Send to your tax advisor" text="Emails the PDF and all four CSV files.">
            <form action={sendReport} className="space-y-3">
              <input type="hidden" name="p" value={per.key === "custom" ? "" : per.key} />
              {per.key === "custom" && <><input type="hidden" name="from" value={per.from} /><input type="hidden" name="to" value={per.to} /></>}
              <div><label className="label" htmlFor="advisor">Email of the tax advisor</label><input id="advisor" name="advisor" type="email" defaultValue={advisor} required className="input" /></div>
              <button className="btn btn-primary w-full">Send report for {per.label}</button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
