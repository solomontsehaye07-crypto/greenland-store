import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { formatNumber, getSeries, isOverdue } from "@/lib/invoices";
import { Msg, OrdersNav } from "../../ui";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";
import { LiveSearchInput } from "@/components/live-search-input";

export const dynamic = "force-dynamic";

const BASE = "/manager/orders/invoices";
type Row = { id: number; number: string | null; status: string; total: number; paid_amount: number | null; issue_date: string | null; due_date: string | null; reminders: number; business_customers: { name: string } | null };

const de = (d: string | null) => (d ? d.split("-").reverse().join(".") : "");

// Invoices for shops and restaurants that pay later by bank transfer.
export default async function Invoices({ searchParams }: { searchParams: Promise<{ f?: string; msg?: string; q?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const { f = "open", msg, q = "" } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data }, series] = await Promise.all([
    sb.from("invoices").select("id, number, status, total, paid_amount, issue_date, due_date, reminders, business_customers(name)").order("created_at", { ascending: false }).limit(300),
    getSeries(),
  ]);
  const all = (data ?? []) as unknown as Row[];
  const openRows = all.filter((r) => r.status === "open");
  const overdue = openRows.filter(isOverdue);
  const due = (r: Row) => Number(r.total) - Number(r.paid_amount ?? 0);
  const sum = (rows: Row[]) => rows.reduce((t, r) => t + due(r), 0);
  const term = q.trim().toLowerCase();
  const shown = all
    .filter((r) => (f === "overdue" ? isOverdue(r) : f === "all" ? true : r.status === f))
    .filter((r) => !term || `${r.number ?? ""} ${r.business_customers?.name ?? ""}`.toLowerCase().includes(term));
  const tabs: [string, string, number][] = [
    ["open", "Open", openRows.length],
    ["overdue", "Overdue", overdue.length],
    ["draft", "Drafts", all.filter((r) => r.status === "draft").length],
    ["paid", "Paid", all.filter((r) => r.status === "paid").length],
    ["all", "All", all.length],
  ];

  return (
    <div className="pb-8">
      <OrdersNav active="invoices" />
      <Msg msg={msg} />
      <div className="grid grid-cols-2 gap-2">
        <div className="mt-c mt-money2 rounded-2xl p-4">
          <p className="text-xs font-semibold opacity-90">Waiting for payment</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(sum(openRows))}</p>
          <p className="text-xs opacity-90">{openRows.length} invoices</p>
        </div>
        <Link href={`${BASE}?f=overdue`} className={`rounded-2xl p-4 ${overdue.length ? "mt-c mt-loss" : "border-2 border-line bg-white"}`}>
          <p className="text-xs font-semibold opacity-90">Overdue</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(sum(overdue))}</p>
          <p className="text-xs opacity-90">{overdue.length} invoices</p>
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <Link href={`${BASE}/new`} className="btn btn-primary min-h-12 text-base font-bold">+ New invoice</Link>
        <Link href={`${BASE}/customers`} className="btn btn-ghost min-h-12 px-4 font-semibold">Customers</Link>
        <Link href={`${BASE}/settings`} className="btn btn-ghost min-h-12 px-3" aria-label="Invoice numbers and settings" title="Numbers & settings">⚙︎</Link>
      </div>
      <p className="mt-2 text-xs text-muted">Next invoice number: <b className="text-ink" data-no-translate>{formatNumber(series, series.next_number)}</b> · <Link href={`${BASE}/settings`} className="underline">change</Link></p>

      <nav aria-label="Filter invoices" className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1">
        {tabs.map(([k, l, n]) => (
          <Link key={k} href={`${BASE}?f=${k}`} aria-current={f === k ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${f === k ? "bg-white shadow-sm" : "text-muted"}`}>
            {l}
            <span className="text-xs tabular-nums">{n}</span>
          </Link>
        ))}
      </nav>
      <form action={BASE} className="mt-2">
        <input type="hidden" name="f" value={f} />
        <LiveSearchInput name="q" defaultValue={q} type="search" placeholder="Find by number or customer" aria-label="Find invoice" className="input" />
      </form>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-white">
        {shown.map((r) => {
          const od = isOverdue(r);
          const chip =
            r.status === "paid" ? ["Paid", "bg-forest/10 text-forest"] : r.status === "cancelled" ? ["Cancelled", "bg-surface text-muted"] : r.status === "draft" ? ["Draft", "bg-saffron/25 text-ink"] : od ? ["Overdue", "bg-terra text-white"] : ["Open", "bg-[#1c4c86]/10 text-[#1c4c86]"];
          return (
            <li key={r.id}>
              <Link href={`${BASE}/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold" data-no-translate>{r.business_customers?.name ?? "—"}</span>
                  <span className="text-xs text-muted" data-no-translate>
                    {r.number ?? "Draft"}
                    {r.issue_date ? ` · ${de(r.issue_date)}` : ""}
                    {r.status === "open" && r.due_date ? ` · due ${de(r.due_date)}` : ""}
                    {r.reminders ? ` · ${r.reminders} reminder${r.reminders > 1 ? "s" : ""}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-base font-bold tabular-nums">{money(r.status === "open" ? due(r) : Number(r.total))}</span>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${chip[1]}`}>{chip[0]}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {!shown.length && <li className="p-6 text-center text-sm text-muted">{all.length ? "No invoices here." : "No invoices yet. Tap “New invoice” to write the first one."}</li>}
      </ul>
    </div>
  );
}
