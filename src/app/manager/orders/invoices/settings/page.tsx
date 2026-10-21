import { supabaseAdmin } from "@/lib/supabase";
import { formatNumber, getSeries } from "@/lib/invoices";
import { BackButton, Msg } from "../../../ui";
import { saveSeries } from "../actions";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Invoice numbers continue from the last number you used before (e.g. in your old program).
export default async function InvoiceSettings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const { msg } = await searchParams;
  const s = await getSeries();
  const { data: last } = await supabaseAdmin().from("invoices").select("number").not("number", "is", null).order("issue_date", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  return (
    <div className="pb-8">
      <div className="mb-3 flex items-center gap-3">
        <BackButton href="/manager/orders/invoices" />
        <h1 className="text-lg font-bold">Invoice numbers</h1>
      </div>
      <Msg msg={msg} />
      <div className="mt-c mt-money2 rounded-2xl p-4">
        <p className="text-sm opacity-90">The next invoice gets the number</p>
        <p className="mt-1 text-2xl font-bold" data-no-translate>{formatNumber(s, s.next_number)}</p>
        {last?.number && <p className="mt-1 text-xs opacity-90">Last issued in this app: <span data-no-translate>{last.number}</span></p>}
      </div>
      <form action={saveSeries} className="mt-4 space-y-4 rounded-2xl border-2 border-line bg-white p-4">
        <div>
          <label className="label" htmlFor="last-no">Your last invoice number</label>
          <input id="last-no" name="last_number" placeholder={formatNumber(s, Math.max(1, s.next_number - 1))} className="input text-lg font-bold" data-no-memory autoComplete="off" />
          <p className="mt-1 text-xs text-muted">
            Type the last number you used (e.g. <b>RE-2026-0147</b> or <b>1046</b>). Numbering continues right after it, in the same style. Leave empty to keep the current numbering.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pay-days">Default payment term (days)</label>
            <input id="pay-days" name="payment_days" inputMode="numeric" defaultValue={s.payment_days} className="input text-base" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="inv-footer">Extra line at the bottom of every invoice (optional)</label>
          <input id="inv-footer" name="footer" defaultValue={s.footer ?? ""} placeholder="e.g. Amtsgericht … / Handelsregister …" className="input text-base" />
        </div>
        <button className="btn btn-primary min-h-12 w-full text-base font-bold">Save</button>
      </form>
      <p className="mt-3 text-xs text-muted">Your bank details and tax number come from Admin → Settings (payments and receipts). The online shop’s receipts keep their own numbers.</p>
    </div>
  );
}
