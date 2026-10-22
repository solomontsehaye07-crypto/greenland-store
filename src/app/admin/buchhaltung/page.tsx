import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import { dailySeries, getAccountingSettings, getOnlineMonth, getShopMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { Bars } from "@/components/admin/charts";
import { ExportLinks, Flash, MonthNav } from "./month-nav";
import { addAdvisor, removeAdvisor, saveAccounting } from "./actions";
import { supabaseAdmin } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";

export const metadata = { title: "Bookkeeping" };
export const dynamic = "force-dynamic";

type View = "both" | "shop" | "online";

export default async function BookkeepingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(["admin"]);
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);
  const m = monthKey(year, month);
  const view: View = sp.v === "shop" || sp.v === "online" ? sp.v : "both";
  const [shop, online, acc, { data: advisors }, { count: changeCount }] = await Promise.all([
    getShopMonth(year, month),
    getOnlineMonth(year, month),
    getAccountingSettings(),
    supabaseAdmin().from("profiles").select("id, email, full_name").eq("role", "tax_advisor").order("email"),
    supabaseAdmin().from("cashbook_changes").select("id", { count: "exact", head: true }),
  ]);
  const portal = `${siteUrl()}/steuerberater`;
  const days = dailySeries(shop, online).filter((d) => d.shopIn || d.shopOut || d.online);
  const showShop = view !== "online";
  const showOnline = view !== "shop";
  const maxDay = Math.max(1, ...days.map((d) => (showShop ? d.shopIn : 0) + (showOnline ? Math.max(d.online, 0) : 0)));
  const tab = (v: View, label: string) => (
    <Link href={`/admin/buchhaltung?m=${m}${v === "both" ? "" : `&v=${v}`}`} aria-current={view === v ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${view === v ? "bg-ink text-white" : "text-muted hover:bg-surface"}`}>
      {label}
    </Link>
  );
  const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-extrabold">Bookkeeping</h1>
          <p className="mt-1 text-sm text-muted">Shop cash book and online shop – kept apart, exported separately for the Steuerberater.</p>
        </div>
        <MonthNav base="/admin/buchhaltung" year={year} month={month} extra={view === "both" ? "" : `&v=${view}`} />
      </header>
      <Flash msg={sp.msg} err={sp.err} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-white p-1" role="navigation" aria-label="Which book">
          {tab("both", "Both")}
          {tab("shop", "Shop (cash book)")}
          {tab("online", "Online shop")}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/buchhaltung/kasse?m=${m}`} className="btn btn-primary !py-2">Open cash book</Link>
          <Link href={`/admin/buchhaltung/online?m=${m}`} className="btn btn-ghost !py-2">Online entries</Link>
        </div>
      </div>

      {showShop && (
        <section aria-labelledby="shop-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="shop-h" className="text-lg font-bold">Shop – cash book (Kasse {acc.cashAccount})</h2>
            {shop.closedAt ? <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">Month closed</span> : <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">Open</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Opening balance" value={money(shop.opening)} />
            <Stat label="Money in" value={money(shop.income)} note={`${shop.entries.filter((e) => e.income).length} entries`} />
            <Stat label="Money out" value={money(shop.expense)} note={`${shop.entries.filter((e) => e.expense).length} entries`} />
            <Stat label="Closing balance" value={money(shop.closing)} />
          </div>
          <ExportLinks book="shop" m={m} label="Export cash book:" />
        </section>
      )}

      {showOnline && (
        <section aria-labelledby="online-h" className="space-y-3">
          <h2 id="online-h" className="text-lg font-bold">Online shop</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Sales (gross)" value={money(online.sales)} note={`${online.lines.filter((l) => l.kind === "sale").length} orders`} />
            <Stat label="Refunds & cancellations" value={money(-online.refunds)} />
            <Stat label="Payment fees" value={money(-online.fees)} note={online.missingFees ? `${online.missingFees} card/PayPal payments without a fee` : undefined} />
            <Stat label="Result" value={money(online.net)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="mb-3 text-sm font-bold">By payment method</h3>
              {online.byMethod.length ? <Bars items={online.byMethod.map((x) => ({ label: x.method, value: x.amount }))} format="eur" color="var(--forest)" /> : <p className="text-sm text-muted">No online payments this month.</p>}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="mb-3 text-sm font-bold">VAT (Umsatzsteuer)</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1 font-medium">Rate</th><th className="py-1 text-right font-medium">Net</th><th className="py-1 text-right font-medium">VAT</th></tr></thead>
                <tbody className="tabular-nums">
                  <tr className="border-t border-line"><td className="py-2">7 %</td><td className="py-2 text-right">{money(online.vat.net7)}</td><td className="py-2 text-right">{money(online.vat.vat7)}</td></tr>
                  <tr className="border-t border-line"><td className="py-2">19 %</td><td className="py-2 text-right">{money(online.vat.net19)}</td><td className="py-2 text-right">{money(online.vat.vat19)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <ExportLinks book="online" m={m} label="Export online book:" />
        </section>
      )}

      <section aria-labelledby="days-h" className="rounded-2xl border border-line bg-white p-5">
        <h2 id="days-h" className="text-lg font-bold">Day by day</h2>
        {days.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 font-medium">Day</th>
                  {showShop && <th className="py-2 text-right font-medium">Shop in</th>}
                  {showShop && <th className="py-2 text-right font-medium">Shop out</th>}
                  {showOnline && <th className="py-2 text-right font-medium">Online</th>}
                  <th className="w-[35%] py-2 pl-4 font-medium"><span className="sr-only">Chart</span></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {days.map((d) => {
                  const a = showShop ? d.shopIn : 0;
                  const b = showOnline ? Math.max(d.online, 0) : 0;
                  return (
                    <tr key={d.date} className="border-t border-line">
                      <td className="py-2">{new Date(d.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                      {showShop && <td className="py-2 text-right">{d.shopIn ? money(d.shopIn) : "–"}</td>}
                      {showShop && <td className="py-2 text-right">{d.shopOut ? money(d.shopOut) : "–"}</td>}
                      {showOnline && <td className="py-2 text-right">{d.online ? money(d.online) : "–"}</td>}
                      <td className="py-2 pl-4" aria-hidden>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
                          {a > 0 && <div style={{ width: `${(a / maxDay) * 100}%`, background: "var(--terra)" }} />}
                          {b > 0 && <div style={{ width: `${(b / maxDay) * 100}%`, background: "var(--forest)" }} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {view === "both" && (
              <p className="mt-3 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--terra)" }} />Shop money in</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--forest)" }} />Online sales</span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing booked this month yet.</p>
        )}
      </section>

      <section id="steuerberater" aria-labelledby="stb-h" className="scroll-mt-6 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="stb-h" className="text-lg font-bold">Steuerberater access</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">A separate login at <a href={portal} className="font-semibold underline">{portal.replace(/^https?:\/\//, "")}</a>. The Steuerberater sees only the cash book, the online book and the change log, and can fill in BU, counter account, VAT and notes – always with a reason. No access to the shop, orders, customers or this admin.</p>
          </div>
          <a href="/steuerberater/protokoll" className="btn btn-ghost !py-1.5 text-sm">Change log ({changeCount ?? 0})</a>
        </div>
        {(advisors ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {(advisors ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span><span className="font-semibold">{a.full_name || a.email}</span>{a.full_name ? <span className="text-muted"> · {a.email}</span> : null}</span>
                <form action={removeAdvisor}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-xs font-semibold text-terra underline">Remove access</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAdvisor} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label htmlFor="stb-email" className="label">Email of the Steuerberater</label><input id="stb-email" name="email" type="email" required className="input" /></div>
          <div><label htmlFor="stb-name" className="label">Name or office (optional)</label><input id="stb-name" name="name" maxLength={120} className="input" /></div>
          <button className="btn btn-primary">Give access</button>
        </form>
        <p className="mt-2 text-xs text-muted">They sign in with a code sent to that email – no password to share. You can open the portal yourself with your admin account to see exactly what they see.</p>
      </section>

      <details className="rounded-2xl border border-line bg-white p-5">
        <summary className="cursor-pointer text-lg font-bold">Settings for the Steuerberater (DATEV)</summary>
        <p className="mt-2 max-w-2xl text-sm text-muted">These numbers go into the DATEV file. Ask your Steuerberater for the Beraternummer and check the accounts with them – the defaults follow SKR03.</p>
        <form action={saveAccounting} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="m" value={m} />
          {[
            ["consultant", "Beraternummer", acc.consultant],
            ["client", "Mandantennummer", acc.client],
            ["cashAccount", "Cash account (Kasse)", acc.cashAccount],
            ["revenue7", "Revenue 7 % account", acc.revenue7],
            ["revenue19", "Revenue 19 % account", acc.revenue19],
            ["transitAccount", "Card/PayPal/transfer account", acc.transitAccount],
            ["feeAccount", "Payment fees account", acc.feeAccount],
          ].map(([k, label, v]) => (
            <div key={k}>
              <label htmlFor={`acc-${k}`} className="label">{label}</label>
              <input id={`acc-${k}`} name={k} defaultValue={v} inputMode="numeric" className="input" />
            </div>
          ))}
          <div>
            <label htmlFor="acc-chart" className="label">Chart of accounts</label>
            <select id="acc-chart" name="chart" defaultValue={acc.chart} className="input">
              <option value="SKR03">SKR03</option>
              <option value="SKR04">SKR04</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><button className="btn btn-primary">Save settings</button></div>
        </form>
      </details>
    </div>
  );
}
