import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { computePnl, EXPENSE_CATEGORIES, monthRange } from "@/lib/finance";
import { Bars } from "@/components/admin/charts";
import { addExpense, addStoreSale, deleteEntry, recordDelivery, recordWriteoff } from "./actions";

export const metadata = { title: "Profit & loss" };

const pct = (x: number | null) => (x === null ? "–" : `${x.toFixed(1).replace(".", ",")} %`);
const REASON: Record<string, string> = { spoiled: "Spoiled", damage: "Damaged", expired: "Expired" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const { from, to, key } = monthRange(sp.m);
  const sb = supabaseAdmin();
  const monthLabel = (d: Date) => d.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  const prevKey = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const nextKey = to.toISOString().slice(0, 7);
  const isFuture = to > new Date(Date.now() + 31 * 86400000);

  const months = Array.from({ length: 6 }, (_, i) => monthRange(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7)));
  const [p, history, { data: cats }, { data: prods }, { data: sales }, { data: exps }, { data: losses }] = await Promise.all([
    computePnl(from, to),
    Promise.all(months.map((r) => computePnl(r.from, r.to))),
    sb.from("categories").select("id, title"),
    sb.from("products").select("sku, title, title_de, stock, cost_price").neq("status", "draft").order("title").limit(5000),
    sb.from("store_sales").select("*").gte("day", from.toISOString().slice(0, 10)).lt("day", to.toISOString().slice(0, 10)).order("day", { ascending: false }),
    sb.from("expenses").select("*").gte("day", from.toISOString().slice(0, 10)).lt("day", to.toISOString().slice(0, 10)).order("day", { ascending: false }),
    sb.from("stock_movements").select("id, qty_change, unit_cost, reason, note, created_at, products(title, title_de)").in("reason", ["spoiled", "damage", "expired"]).order("created_at", { ascending: false }).limit(12),
  ]);
  const catName = (id: number) => cats?.find((c) => c.id === id)?.title ?? "Uncategorised";
  const stockValue = (prods ?? []).reduce((a, r) => a + (r.cost_price ? Number(r.cost_price) * Math.max(r.stock, 0) : 0), 0);
  const noCost = (prods ?? []).filter((r) => r.cost_price == null && r.stock > 0).length;
  const here = `/admin/finance${sp.m ? `?m=${sp.m}` : ""}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-extrabold">Profit &amp; loss</h1>
          <p className="mt-1 text-sm text-muted">All figures net of VAT. Goods are valued at purchase cost.</p>
        </div>
        <nav className="flex items-center gap-2" aria-label="Month">
          <Link href={`/admin/finance?m=${prevKey}`} className="btn btn-ghost !py-1.5" aria-label="Previous month">←</Link>
          <span className="min-w-36 text-center font-semibold capitalize">{monthLabel(from)}</span>
          {!isFuture && <Link href={`/admin/finance?m=${nextKey}`} className="btn btn-ghost !py-1.5" aria-label="Next month">→</Link>}
        </nav>
      </header>

      {sp.msg && <p role="status" className="rounded-xl bg-forest/10 px-4 py-3 text-sm font-medium text-forest">{sp.msg}</p>}
      {(noCost > 0 || p.uncosted > 0) && (
        <p className="rounded-xl bg-[#fff4dc] px-4 py-3 text-sm">
          {noCost} products in stock have no purchase cost yet{p.uncosted ? `, and ${p.uncosted} stock movements this month could not be valued` : ""}. Costs and losses are only as complete as these numbers.{" "}
          <Link href="/admin/pricing?view=nocost" className="font-semibold underline">Enter purchase costs</Link>
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={money(p.revenue)} detail={`Online ${money(p.revenueOnline)} · Store ${money(p.revenueStore)}`} />
        <Kpi label="Gross profit" value={money(p.grossProfit)} detail={`Margin ${pct(p.grossMargin)}`} tone={p.grossProfit < 0 ? "bad" : "good"} />
        <Kpi label="Thrown away (write-offs)" value={money(p.writeoffs)} detail={`Loss rate ${pct(p.lossRate)} of goods bought`} tone={p.lossRate !== null && p.lossRate > 5 ? "bad" : undefined} />
        <Kpi label="Net profit" value={money(p.netProfit)} detail={`Net margin ${pct(p.netMargin)}`} tone={p.netProfit < 0 ? "bad" : "good"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Statement for {monthLabel(from)}</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <Line label="Online sales" value={p.revenueOnline} note={`${p.orders} paid orders`} />
              <Line label="In-store sales" value={p.revenueStore} note={`${sales?.length ?? 0} till totals`} />
              <Line label="Revenue" value={p.revenue} strong />
              <Line label="Cost of goods sold" value={-p.cogs} note="Sales and stock counts, at cost" />
              <Line label="Write-offs (spoiled, damaged, expired)" value={-p.writeoffs} note={`${pct(p.lossRate)} of ${money(p.purchases)} bought`} />
              <Line label="Gross profit" value={p.grossProfit} strong note={`Margin ${pct(p.grossMargin)}`} />
              {p.expensesByCategory.map((e) => <Line key={e.label} label={e.label} value={-e.value} />)}
              {!p.expensesByCategory.length && <Line label="Running costs" value={0} note="None entered" />}
              <Line label="Net profit" value={p.netProfit} strong note={`Margin ${pct(p.netMargin)}`} />
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface p-3"><div className="text-xs text-muted">Goods bought this month</div><div className="font-semibold">{money(p.purchases)}</div></div>
            <div className="rounded-xl bg-surface p-3"><div className="text-xs text-muted">Stock value at cost (today)</div><div className="font-semibold">{money(stockValue)}</div></div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Last 6 months</h2>
          <p className="text-xs text-muted">Gross profit per month</p>
          <div className="mt-3">
            <Bars items={history.map((h, i) => ({ label: monthLabel(months[i].from).slice(0, 3) + " " + String(months[i].from.getUTCFullYear()).slice(2), value: Math.round(h.grossProfit), href: `/admin/finance?m=${months[i].key}` }))} format="eur" color="var(--forest)" />
          </div>
          <p className="mt-4 text-xs text-muted">Write-offs per month</p>
          <div className="mt-2">
            <Bars items={history.map((h, i) => ({ label: monthLabel(months[i].from).slice(0, 3) + " " + String(months[i].from.getUTCFullYear()).slice(2), value: Math.round(h.writeoffs), href: `/admin/finance?m=${months[i].key}` }))} format="eur" color="var(--danger)" />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Loss by category</h2>
          <p className="text-xs text-muted">Write-offs at cost divided by goods bought in the same month. Fresh produce usually runs highest.</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2">Category</th><th className="text-right">Bought</th><th className="text-right">Thrown away</th><th className="text-right">Loss</th></tr></thead>
            <tbody>
              {p.lossByCategory.map((c) => (
                <tr key={c.category_id} className="border-b border-line">
                  <td className="py-2">{catName(c.category_id)}</td>
                  <td className="text-right">{money(c.purchases)}</td>
                  <td className="text-right">{money(c.writeoffs)}</td>
                  <td className={`text-right font-semibold ${c.rate !== null && c.rate > 10 ? "text-danger" : ""}`}>{pct(c.rate)}</td>
                </tr>
              ))}
              {!p.lossByCategory.length && <tr><td colSpan={4} className="py-6 text-center text-muted">No deliveries or write-offs recorded this month.</td></tr>}
            </tbody>
          </table>
          {p.topLosses.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-bold">Most thrown away</h3>
              <ul className="mt-2 text-sm">
                {p.topLosses.map((t) => (
                  <li key={t.product_id} className="flex justify-between gap-3 border-b border-line py-1.5">
                    <span className="line-clamp-1">{t.title} <span className="text-xs text-muted">· {t.qty} pcs · {t.reasons.split(", ").map((r) => REASON[r] ?? r).join(", ")}</span></span>
                    <span className="font-medium">{money(t.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-5">
            <h2 className="text-lg font-bold">Throw away (write-off)</h2>
            <p className="text-xs text-muted">For rotten chillies, okra, broken jars or expired goods. Stock goes down and the cost counts as a loss.</p>
            <form action={recordWriteoff} className="mt-3 grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="return" value={here} />
              <div className="sm:col-span-6"><label className="label" htmlFor="wo-product">Product</label><input id="wo-product" name="product" list="product-list" required className="input" placeholder="Type name or SKU" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="wo-qty">Quantity</label><input id="wo-qty" name="qty" type="number" min="1" required className="input" /></div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="wo-reason">Reason</label>
                <select id="wo-reason" name="reason" className="input"><option value="spoiled">Spoiled / rotten</option><option value="damage">Damaged</option><option value="expired">Expired</option></select>
              </div>
              <div className="sm:col-span-2"><label className="label" htmlFor="wo-cost">Cost per item €</label><input id="wo-cost" name="cost" inputMode="decimal" className="input" placeholder="from product" /></div>
              <div className="sm:col-span-4"><label className="label" htmlFor="wo-note">Note</label><input id="wo-note" name="note" className="input" /></div>
              <button className="btn btn-primary self-end sm:col-span-2">Save write-off</button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-5">
            <h2 className="text-lg font-bold">Goods received</h2>
            <p className="text-xs text-muted">Books stock in and updates the product&#39;s average purchase cost.</p>
            <form action={recordDelivery} className="mt-3 grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="return" value={here} />
              <div className="sm:col-span-6"><label className="label" htmlFor="gr-product">Product</label><input id="gr-product" name="product" list="product-list" required className="input" placeholder="Type name or SKU" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="gr-qty">Quantity</label><input id="gr-qty" name="qty" type="number" min="1" required className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="gr-cost">Cost per item, net €</label><input id="gr-cost" name="cost" inputMode="decimal" required className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="gr-bb">Best before</label><input id="gr-bb" name="best_before" type="date" className="input" /></div>
              <button className="btn btn-primary sm:col-span-2">Book delivery</button>
            </form>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">In-store sales (till totals)</h2>
          <form action={addStoreSale} className="mt-3 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="return" value={here} />
            <div><label className="label" htmlFor="ss-day">Day</label><input id="ss-day" name="day" type="date" defaultValue={today} required className="input" /></div>
            <div><label className="label" htmlFor="ss-7">Gross 7 % €</label><input id="ss-7" name="gross_7" inputMode="decimal" className="input" placeholder="Food" /></div>
            <div><label className="label" htmlFor="ss-19">Gross 19 % €</label><input id="ss-19" name="gross_19" inputMode="decimal" className="input" placeholder="Other" /></div>
            <button className="btn btn-primary self-end">Add</button>
          </form>
          <EntryList table="store_sales" here={here} rows={(sales ?? []).map((s) => ({ id: s.id, day: s.day, label: `7 %: ${money(s.gross_7)} · 19 %: ${money(s.gross_19)}`, value: Number(s.gross_7) + Number(s.gross_19) }))} />
        </section>

        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Running costs</h2>
          <form action={addExpense} className="mt-3 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="return" value={here} />
            <div><label className="label" htmlFor="ex-day">Date</label><input id="ex-day" name="day" type="date" defaultValue={today} required className="input" /></div>
            <div>
              <label className="label" htmlFor="ex-cat">Type</label>
              <select id="ex-cat" name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div><label className="label" htmlFor="ex-amount">Amount net €</label><input id="ex-amount" name="amount" inputMode="decimal" required className="input" /></div>
            <button className="btn btn-primary self-end">Add</button>
          </form>
          <EntryList table="expenses" here={here} rows={(exps ?? []).map((e) => ({ id: e.id, day: e.day, label: `${e.category}${e.note ? ` · ${e.note}` : ""}`, value: Number(e.amount) }))} />
        </section>
      </div>

      {losses && losses.length > 0 && (
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Recent write-offs</h2>
          <ul className="mt-2 text-sm">
            {losses.map((l) => {
              const prod = l.products as unknown as { title: string; title_de: string | null } | null;
              return (
                <li key={l.id} className="flex flex-wrap justify-between gap-3 border-b border-line py-1.5">
                  <span>{new Date(l.created_at).toLocaleDateString("de-DE")} · {prod?.title_de || prod?.title} · {Math.abs(l.qty_change)} pcs · {REASON[l.reason] ?? l.reason}{l.note ? ` · ${l.note}` : ""}</span>
                  <span className="font-medium">{l.unit_cost == null ? "no cost" : money(Math.abs(l.qty_change) * Number(l.unit_cost))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <datalist id="product-list">
        {(prods ?? []).map((r) => <option key={r.sku} value={`${r.sku} – ${r.title_de || r.title}`} />)}
      </datalist>
      <input type="hidden" value={key} readOnly />
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-danger" : tone === "good" ? "text-forest" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </div>
  );
}

function Line({ label, value, note, strong }: { label: string; value: number; note?: string; strong?: boolean }) {
  return (
    <tr className={`border-b border-line ${strong ? "font-bold" : ""}`}>
      <td className="py-2">{label}{note && <span className="block text-xs font-normal text-muted">{note}</span>}</td>
      <td className={`text-right tabular-nums ${value < 0 ? "text-danger" : ""}`}>{value < 0 ? "−" : ""}{money(Math.abs(value))}</td>
    </tr>
  );
}

function EntryList({ rows, table, here }: { rows: { id: number; day: string; label: string; value: number }[]; table: string; here: string }) {
  if (!rows.length) return <p className="mt-4 text-sm text-muted">Nothing entered for this month yet.</p>;
  return (
    <ul className="mt-4 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-1.5">
          <span>{new Date(r.day).toLocaleDateString("de-DE")} · {r.label}</span>
          <span className="flex items-center gap-3">
            <span className="font-medium">{money(r.value)}</span>
            <form action={deleteEntry}>
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="return" value={here} />
              <button className="text-xs text-muted underline hover:text-danger" aria-label={`Delete entry from ${r.day}`}>Delete</button>
            </form>
          </span>
        </li>
      ))}
    </ul>
  );
}
