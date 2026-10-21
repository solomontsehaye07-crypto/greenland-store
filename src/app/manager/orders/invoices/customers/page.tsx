import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getSeries } from "@/lib/invoices";
import { BackButton, Msg } from "../../../ui";
import { CustomerForm, type Customer } from "../customer-form";

export const dynamic = "force-dynamic";
const BASE = "/manager/orders/invoices";

export default async function Customers({ searchParams }: { searchParams: Promise<{ id?: string; new?: string; msg?: string }> }) {
  const sp = await searchParams;
  const sb = supabaseAdmin();
  const [{ data }, series] = await Promise.all([sb.from("business_customers").select("*").eq("active", true).order("name"), getSeries()]);
  const list = (data ?? []) as Customer[];
  const edit = sp.id ? list.find((c) => c.id === Number(sp.id)) : null;
  if (sp.new || edit) {
    return (
      <div className="pb-8">
        <div className="mb-3 flex items-center gap-3">
          <BackButton href={`${BASE}/customers`} />
          <h1 className="text-lg font-bold">{edit ? "Edit customer" : "New customer"}</h1>
        </div>
        <Msg msg={sp.msg} />
        <CustomerForm c={edit} defaultDays={series.payment_days} />
      </div>
    );
  }
  return (
    <div className="pb-8">
      <div className="mb-3 flex items-center gap-3">
        <BackButton href={BASE} />
        <h1 className="flex-1 text-lg font-bold">Customers</h1>
        <Link href={`${BASE}/customers?new=1`} className="btn btn-primary px-4 font-semibold">+ New</Link>
      </div>
      <Msg msg={sp.msg} />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-white">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`${BASE}/customers?id=${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold" data-no-translate>{c.name}</span>
                <span className="block truncate text-xs text-muted" data-no-translate>
                  {[c.contact_name, [c.postal, c.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "No address yet"}
                  {Number(c.discount_pct) ? ` · ${Number(c.discount_pct)} % discount` : ""}
                </span>
              </span>
              <span aria-hidden className="text-2xl text-muted">›</span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-muted">No customers yet.</li>}
      </ul>
    </div>
  );
}
