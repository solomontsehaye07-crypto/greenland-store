import { supabaseAdmin } from "@/lib/supabase";
import { getSeries } from "@/lib/invoices";
import { BackButton, Msg } from "../../../ui";
import { CustomerForm } from "../customer-form";
import { newInvoice } from "../actions";

export const dynamic = "force-dynamic";

// Step 1 of a new invoice: who is it for?
export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ msg?: string; find?: string; add?: string }> }) {
  const { msg, find = "", add } = await searchParams;
  const [{ data }, series] = await Promise.all([supabaseAdmin().from("business_customers").select("id, name, city, contact_name").eq("active", true).order("name"), getSeries()]);
  const term = find.trim().toLowerCase();
  const list = (data ?? []).filter((c) => !term || c.name.toLowerCase().includes(term));
  return (
    <div className="pb-8">
      <div className="mb-3 flex items-center gap-3">
        <BackButton href="/manager/orders/invoices" />
        <h1 className="text-lg font-bold">Who is the invoice for?</h1>
      </div>
      <Msg msg={msg} />
      {add || !(data ?? []).length ? (
        <>
          <p className="mb-2 text-sm text-muted">New customer – you can pick them next time.</p>
          <CustomerForm back="new-invoice" defaultDays={series.payment_days} />
        </>
      ) : (
        <>
          <form action="/manager/orders/invoices/new" className="flex gap-2">
            <input name="find" defaultValue={find} type="search" placeholder="Find a customer" aria-label="Find a customer" className="input flex-1" />
          </form>
          <ul className="mt-3 space-y-2">
            {list.map((c) => (
              <li key={c.id}>
                <form action={newInvoice}>
                  <input type="hidden" name="customer_id" value={c.id} />
                  <button className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 text-left active:bg-surface">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold" data-no-translate>{c.name}</span>
                      <span className="block truncate text-xs text-muted" data-no-translate>{[c.contact_name, c.city].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span aria-hidden className="text-2xl text-muted">›</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <a href="/manager/orders/invoices/new?add=1" className="btn btn-ghost mt-3 min-h-12 w-full font-semibold">+ New customer</a>
        </>
      )}
    </div>
  );
}
