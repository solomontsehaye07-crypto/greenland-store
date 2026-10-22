import { getAccountingSettings, getOnlineMonth, parseMonth } from "@/lib/cashbook";
import { GridScroll } from "../client";
import { MonthStrip, Ribbon, deDate, eur, monthParam } from "../toolbar";

export const metadata = { title: { absolute: "Online-Shop – Kanzlei-Zugang" } };

const KIND = { sale: "Verkauf", refund: "Erstattung", fee: "Gebühr" } as const;

// Read-only: the online book is built from the orders; corrections happen there (refund/cancel).
export default async function PortalOnline({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { year, month } = parseMonth(monthParam(sp));
  const [o, acc] = await Promise.all([getOnlineMonth(year, month), getAccountingSettings()]);
  const n = (v: number) => (v ? eur(v) : "");
  return (
    <>
      <MonthStrip base="/steuerberater/online" year={year} month={month} title="Online-Shop" book="online" />
      <Ribbon
        items={[
          { label: "Verkäufe", value: eur(o.sales) },
          { label: "Erstattungen", value: eur(o.refunds), op: "−" },
          { label: "Gebühren", value: eur(o.fees), op: "−" },
          { label: "Netto-Zufluss", value: eur(o.net), op: "=", strong: true },
        ]}
        meta={`Verrechnungskonto ${acc.transitAccount} · nur lesen, entsteht aus den Bestellungen`}
      />
      {o.missingFees > 0 && <p className="rounded-lg bg-[#fdf3dc] px-4 py-2.5 text-[#6b5208]">Bei {o.missingFees} Kartenzahlung(en) fehlt die Gebühr des Zahlungsanbieters – bitte mit der Abrechnung von Stripe/PayPal abgleichen.</p>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Online-Umsätze" className="stb-sheet">
          <GridScroll className="max-h-[66vh] overflow-auto">
            <table className="stb-grid min-w-[58rem]">
              <thead>
                <tr className="group"><th colSpan={5}>Zahlung</th><th colSpan={4}>Umsatzsteuer</th><th></th></tr>
                <tr>
                  <th>Datum</th><th>Art</th><th>Bestellung</th><th>Zahlungsart</th><th className="num">Brutto</th>
                  <th className="num">Netto 7 %</th><th className="num">USt 7 %</th><th className="num">Netto 19 %</th><th className="num">USt 19 %</th>
                  <th className="w-full">Buchungstext</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={`${l.orderId}-${l.kind}`}>
                    <td><span>{deDate(l.date)}</span></td>
                    <td><span className={l.kind === "sale" ? "" : "text-terra"}>{KIND[l.kind]}</span></td>
                    <td><span>{l.order}</span></td>
                    <td><span>{l.method}</span></td>
                    <td className="num font-semibold"><span>{eur(l.gross)}</span></td>
                    <td className="k num"><span>{n(l.net7)}</span></td>
                    <td className="k num"><span>{n(l.vat7)}</span></td>
                    <td className="k num"><span>{n(l.net19)}</span></td>
                    <td className="k num"><span>{n(l.vat19)}</span></td>
                    <td><span>{l.text}</span></td>
                  </tr>
                ))}
                {!o.lines.length && <tr><td colSpan={10}><span className="!py-6 text-center text-muted">Keine Online-Umsätze in diesem Monat.</span></td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Summe</td>
                  <td className="num">{eur(o.net)}</td>
                  <td className="num">{eur(o.vat.net7)}</td>
                  <td className="num">{eur(o.vat.vat7)}</td>
                  <td className="num">{eur(o.vat.net19)}</td>
                  <td className="num">{eur(o.vat.vat19)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </GridScroll>
        </section>
        <aside className="stb-sheet p-5">
          <p className="display text-lg font-bold">Nach Zahlungsart</p>
          {o.byMethod.length ? (
            <ul className="mt-2 divide-y divide-line">
              {o.byMethod.map((b) => <li key={b.method} className="flex justify-between py-2"><span>{b.method}</span><span className="num font-semibold">{eur(b.amount)} €</span></li>)}
            </ul>
          ) : <p className="mt-1 text-muted">Keine Zahlungen.</p>}
        </aside>
      </div>
    </>
  );
}
