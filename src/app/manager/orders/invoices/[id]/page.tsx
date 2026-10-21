import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { formatNumber, getSeries, isOverdue, netFromGross } from "@/lib/invoices";
import { invoiceTotals, round2 } from "@/lib/invoice-pdf";
import { AutoForm } from "@/components/auto-form";
import { BackButton, Msg } from "../../../ui";
import { DocRow } from "./doc-buttons";
import { addCustomLine, addProductLine, cancelInvoice, issueInvoice, markPaid, markUnpaid, removeLine, saveInvoiceDetails, updateLine } from "../actions";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
const BASE = "/manager/orders/invoices";
const de = (d: string | null) => (d ? d.split("-").reverse().join(".") : "–");
const n2 = (n: number) => String(round2(n)).replace(".", ",");
const p2 = (n: number) => round2(n).toFixed(2).replace(".", ",");

type Item = { id: number; product_id: number | null; title: string; sku: string | null; size: string | null; qty: number; unit_net: number; tax_rate: number };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; q?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const id = Number((await params).id);
  const { msg, q = "" } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data: inv }, { data: rows }, series] = await Promise.all([
    sb.from("invoices").select("*, business_customers(*)").eq("id", id).single(),
    sb.from("invoice_items").select("id, product_id, title, sku, size, qty, unit_net, tax_rate").eq("invoice_id", id).order("position").order("id"),
    getSeries(),
  ]);
  if (!inv) notFound();
  const items = ((rows ?? []) as Item[]).map((i) => ({ ...i, qty: Number(i.qty), unit_net: Number(i.unit_net), tax_rate: Number(i.tax_rate) }));
  const cust = (inv.status === "draft" || !inv.customer?.name ? inv.business_customers : inv.customer) ?? {};
  const t = invoiceTotals(items);
  const draft = inv.status === "draft";
  const overdue = isOverdue(inv);
  const open = round2(t.gross - Number(inv.paid_amount ?? 0));
  const phone = inv.business_customers?.whatsapp || inv.business_customers?.phone || null;
  const today = new Date().toISOString().slice(0, 10);

  // product search for drafts
  let found: { id: number; title: string; price: number; tax_rate: number; stock: number; image_url: string | null }[] = [];
  if (draft && q.trim()) {
    const term = q.trim().replace(/[%,()]/g, " ");
    const { data } = await sb.from("products").select("id, title, price, tax_rate, stock, image_url").neq("status", "draft").or(`title.ilike.%${term}%,sku.ilike.%${term}%,title_de.ilike.%${term}%${/^\d{8,14}$/.test(term) ? `,ean.eq.${term}` : ""}`).order("title").limit(25);
    found = (data ?? []) as typeof found;
  }

  const stage = inv.status === "paid" ? ["Paid", "mt-c mt-stock"] : inv.status === "cancelled" ? ["Cancelled", "bg-surface text-muted"] : draft ? ["Draft – not issued yet", "bg-saffron/30 text-ink"] : overdue ? [`Overdue since ${de(inv.due_date)}`, "mt-c mt-loss"] : [`Open – due ${de(inv.due_date)}`, "mt-c mt-money2"];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <BackButton href={BASE} />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold" data-no-translate>{cust.name ?? "Invoice"}</h1>
          <p className="text-xs text-muted" data-no-translate>{inv.number ?? `Next number: ${formatNumber(series, series.next_number)}`}</p>
        </div>
      </div>
      <p className={`rounded-2xl px-4 py-3 text-base font-bold ${stage[1]}`}>{stage[0]}</p>
      <Msg msg={msg} />

      {/* ---------- lines ---------- */}
      <section aria-label="Products on the invoice">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-white">
          {items.map((i, n) => (
            <li key={i.id} className="flex items-start gap-3 py-3 pl-3 pr-2">
              <span className="mt-0.5 w-5 shrink-0 text-sm text-muted">{n + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-snug" data-no-translate>{i.title}</p>
                <p className="text-xs text-muted">{[i.size, `${i.tax_rate} % VAT`].filter(Boolean).join(" · ")}</p>
                {draft ? (
                  <AutoForm action={updateLine} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="invoice_id" value={id} />
                    <input type="hidden" name="item_id" value={i.id} />
                    <label className="text-xs text-muted">
                      Qty
                      <input name="qty" defaultValue={n2(i.qty)} inputMode="decimal" data-no-memory className="mt-0.5 block h-10 w-16 rounded-lg border border-line bg-white text-center text-base font-bold" />
                    </label>
                    <span className="pb-2 text-muted">×</span>
                    <label className="text-xs text-muted">
                      Net price €
                      <input name="unit_net" defaultValue={p2(i.unit_net)} inputMode="decimal" data-no-memory className="mt-0.5 block h-10 w-24 rounded-lg border border-line bg-white text-center text-base font-bold" />
                    </label>
                    <span className="pb-2 text-sm font-bold tabular-nums">= {money(i.qty * i.unit_net)}</span>
                  </AutoForm>
                ) : (
                  <p className="mt-1 text-sm tabular-nums">
                    {n2(i.qty)} × {money(i.unit_net)} = <b>{money(i.qty * i.unit_net)}</b>
                  </p>
                )}
              </div>
              {draft && (
                <form action={removeLine}>
                  <input type="hidden" name="invoice_id" value={id} />
                  <input type="hidden" name="item_id" value={i.id} />
                  <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-terra" aria-label={`Remove ${i.title}`} title="Remove">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </form>
              )}
            </li>
          ))}
          {!items.length && <li className="p-5 text-center text-sm text-muted">No products yet. Search below to add them.</li>}
        </ul>

        {/* totals */}
        <div className="mt-2 rounded-2xl bg-surface p-4 text-sm tabular-nums">
          <p className="flex justify-between"><span>Net</span><span>{money(t.net)}</span></p>
          {t.rates.map((r) => (
            <p key={r.rate} className="flex justify-between text-muted"><span>+ {r.rate} % VAT on {money(r.net)}</span><span>{money(r.vat)}</span></p>
          ))}
          <p className="mt-1 flex justify-between border-t border-line pt-1 text-lg font-bold"><span>Total</span><span>{money(t.gross)}</span></p>
          {inv.paid_amount != null && inv.status !== "paid" && <p className="flex justify-between font-semibold text-terra"><span>Still open</span><span>{money(open)}</span></p>}
        </div>
      </section>

      {draft && (
        <>
          {/* add products */}
          <section className="rounded-2xl border-2 border-line bg-white p-3" aria-label="Add products">
            <form action={`${BASE}/${id}`} className="flex gap-2">
              <input name="q" defaultValue={q} type="search" placeholder="Add product: name, SKU or barcode" aria-label="Search products" className="input flex-1 text-base" />
              <button className="btn btn-primary px-4">Find</button>
            </form>
            {q && (
              <ul className="mt-2 divide-y divide-line">
                {found.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url ? <img src={p.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-line object-contain" /> : <span className="h-11 w-11 shrink-0 rounded-lg bg-surface" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold" data-no-translate>{p.title}</span>
                      <span className="text-xs text-muted">
                        {money(netFromGross(Number(p.price), Number(p.tax_rate ?? 7), Number(inv.discount_pct ?? 0)))} net · {p.stock} in stock
                      </span>
                    </span>
                    <form action={addProductLine}>
                      <input type="hidden" name="invoice_id" value={id} />
                      <input type="hidden" name="product_id" value={p.id} />
                      <input type="hidden" name="q" value={q} />
                      <button className="h-11 rounded-xl bg-forest px-4 text-sm font-bold text-white">+ Add</button>
                    </form>
                  </li>
                ))}
                {!found.length && <li className="py-3 text-sm text-muted">Nothing found for “{q}”.</li>}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Add a line that is not a product (e.g. delivery)</summary>
              <form action={addCustomLine} className="mt-2 grid grid-cols-2 gap-2">
                <input type="hidden" name="invoice_id" value={id} />
                <input name="title" placeholder="Description, e.g. Lieferung" aria-label="Description" className="input col-span-2 text-base" />
                <input name="qty" defaultValue="1" inputMode="decimal" aria-label="Quantity" className="input text-base" />
                <input name="unit_net" placeholder="Net price €" inputMode="decimal" aria-label="Net price" className="input text-base" />
                <select name="tax_rate" defaultValue="19" aria-label="VAT rate" className="input text-base">
                  <option value="19">19 % VAT</option>
                  <option value="7">7 % VAT</option>
                  <option value="0">0 % VAT</option>
                </select>
                <button className="btn btn-ghost">Add line</button>
              </form>
            </details>
          </section>

          {/* details */}
          <form action={saveInvoiceDetails} className="space-y-3 rounded-2xl border-2 border-line bg-white p-4">
            <input type="hidden" name="invoice_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="d-del">Delivery date</label>
                <input id="d-del" name="delivery_date" type="date" defaultValue={inv.delivery_date ?? today} className="input text-base" />
              </div>
              <div>
                <label className="label" htmlFor="d-days">Pay within (days)</label>
                <input id="d-days" name="payment_days" inputMode="numeric" defaultValue={inv.payment_days} className="input text-base" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="d-issue">Invoice date (empty = the day you issue it)</label>
                <input id="d-issue" name="issue_date" type="date" defaultValue={inv.issue_date ?? ""} className="input text-base" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="d-notes">Note on the invoice (optional)</label>
              <textarea id="d-notes" name="notes" rows={2} defaultValue={inv.notes ?? ""} className="input" />
            </div>
            <button className="btn btn-ghost w-full">Save details</button>
          </form>

          <Link href={`${BASE}/${id}/pdf?kind=invoice`} className="btn btn-ghost min-h-12 w-full font-semibold">Preview the invoice</Link>
          <form action={issueInvoice}>
            <input type="hidden" name="invoice_id" value={id} />
            <button disabled={!items.length} className="mt-c mt-money2 flex min-h-14 w-full items-center justify-center rounded-2xl px-4 text-base font-bold disabled:opacity-50">
              Issue invoice {formatNumber(series, series.next_number)}
            </button>
            <p className="mt-1 text-center text-xs text-muted">Gives it its number and takes the products out of stock. After that it can’t be changed – only cancelled.</p>
          </form>
          <form action={cancelInvoice}>
            <input type="hidden" name="invoice_id" value={id} />
            <button className="w-full py-2 text-sm font-semibold text-terra underline">Delete this draft</button>
          </form>
        </>
      )}

      {!draft && (
        <>
          <section className="space-y-2" aria-label="Documents">
            <DocRow id={id} kind="invoice" label={`Invoice ${inv.number}`} sub={`${de(inv.issue_date)} · ${money(t.gross)}`} phone={phone} primary={inv.status === "open"} />
            <DocRow id={id} kind="delivery" label="Delivery note" sub="Without prices, for the driver and the customer" phone={phone} />
            {inv.status === "open" && (
              <DocRow id={id} kind="reminder" label={`${(inv.reminders ?? 0) + 1}. Payment reminder`} sub={inv.reminders ? `Last reminder ${de(String(inv.last_reminder_at).slice(0, 10))}` : overdue ? "The invoice is overdue" : "Only needed once it is overdue"} phone={phone} primary={overdue} />
            )}
          </section>

          {inv.status === "open" && (
            <form action={markPaid} className="space-y-3 rounded-2xl border-2 border-forest/40 bg-white p-4">
              <input type="hidden" name="invoice_id" value={id} />
              <p className="text-base font-bold">Money received?</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="p-date">Date</label>
                  <input id="p-date" name="paid_at" type="date" defaultValue={today} className="input text-base" />
                </div>
                <div>
                  <label className="label" htmlFor="p-amt">Amount €</label>
                  <input id="p-amt" name="paid_amount" inputMode="decimal" defaultValue={p2(open)} className="input text-base" data-no-memory />
                </div>
              </div>
              <button className="btn btn-primary min-h-12 w-full text-base font-bold">Mark as paid</button>
            </form>
          )}
          {inv.status === "paid" && (
            <div className="rounded-2xl border-2 border-line bg-white p-4 text-sm">
              <p>Paid on <b>{de(inv.paid_at)}</b> · {money(Number(inv.paid_amount ?? t.gross))}</p>
              <form action={markUnpaid} className="mt-2">
                <input type="hidden" name="invoice_id" value={id} />
                <button className="text-sm font-semibold text-muted underline">Mark as not paid</button>
              </form>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-white p-4 text-sm" data-no-translate>
            <p className="font-semibold">{cust.name}</p>
            <p className="text-muted">{[cust.street, [cust.postal, cust.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-muted">Delivered {de(inv.delivery_date)} · issued {de(inv.issue_date)} · due {de(inv.due_date)}</p>
          </div>

          {inv.status !== "cancelled" && (
            <details className="rounded-2xl border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-terra">Cancel this invoice</summary>
              <p className="mt-2 text-sm text-muted">The invoice keeps its number (no gaps) and is marked as cancelled. The products go back into stock. Send the customer the cancelled PDF.</p>
              <form action={cancelInvoice} className="mt-3">
                <input type="hidden" name="invoice_id" value={id} />
                <button className="btn w-full border-2 border-terra/50 font-semibold text-terra">Yes, cancel invoice {inv.number}</button>
              </form>
            </details>
          )}
        </>
      )}
    </div>
  );
}
