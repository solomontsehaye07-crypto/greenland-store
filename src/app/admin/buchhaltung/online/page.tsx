import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import { getOnlineMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { ExportLinks, MonthNav } from "../month-nav";

export const metadata = { title: "Online book" };
export const dynamic = "force-dynamic";

const KIND = { sale: "Sale", refund: "Refund", fee: "Fee" } as const;
const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export default async function OnlineBookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(["admin"]);
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);
  const m = monthKey(year, month);
  const book = await getOnlineMonth(year, month);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/admin/buchhaltung?m=${m}`} className="text-sm text-muted underline">Bookkeeping</Link>
          <h1 className="display mt-1 text-3xl font-extrabold">Online book</h1>
          <p className="mt-1 text-sm text-muted">Built automatically from paid, refunded and cancelled web orders. Nothing to type.</p>
        </div>
        <MonthNav base="/admin/buchhaltung/online" year={year} month={month} />
      </header>
      {book.missingFees > 0 && (
        <p className="rounded-xl bg-[#fff4dc] px-4 py-3 text-sm">{book.missingFees} card or PayPal payments have no fee recorded (for example orders paid before this feature). Compare them with the provider&apos;s monthly statement.</p>
      )}
      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <p className="text-sm"><strong>{money(book.sales)}</strong> sales · <strong>{money(-book.refunds)}</strong> refunds · <strong>{money(-book.fees)}</strong> fees · result <strong>{money(book.net)}</strong></p>
          <ExportLinks book="online" m={m} label="Export:" />
        </div>
        {book.lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-surface text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 text-right font-medium">Gross</th>
                  <th className="px-3 py-2 text-right font-medium">Net 7 %</th>
                  <th className="px-3 py-2 text-right font-medium">VAT 7 %</th>
                  <th className="px-3 py-2 text-right font-medium">Net 19 %</th>
                  <th className="px-3 py-2 text-right font-medium">VAT 19 %</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {book.lines.map((l, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="whitespace-nowrap px-3 py-2">{de(l.date)}</td>
                    <td className="px-3 py-2">{KIND[l.kind]}</td>
                    <td className="px-3 py-2"><Link href={`/admin/orders/${l.orderId}`} className="underline">#{l.order}</Link></td>
                    <td className="px-3 py-2">{l.method}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${l.gross < 0 ? "text-terra" : ""}`}>{money(l.gross)}</td>
                    <td className="px-3 py-2 text-right">{l.net7 ? money(l.net7) : ""}</td>
                    <td className="px-3 py-2 text-right">{l.vat7 ? money(l.vat7) : ""}</td>
                    <td className="px-3 py-2 text-right">{l.net19 ? money(l.net19) : ""}</td>
                    <td className="px-3 py-2 text-right">{l.vat19 ? money(l.vat19) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted">No paid or refunded online orders this month.</p>
        )}
      </section>
    </div>
  );
}
