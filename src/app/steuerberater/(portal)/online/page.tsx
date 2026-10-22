import { getAccountingSettings, getOnlineMonth, monthKey, parseMonth } from "@/lib/cashbook";
import { GridScroll } from "../client";
import { Crumbs, HeadForm, IconBar, MONATE, deDate, eur, monthParam } from "../toolbar";

export const metadata = { title: { absolute: "Online-Shop – Steuerberater-Portal" } };

const KIND = { sale: "Verkauf", refund: "Erstattung", fee: "Gebühr" } as const;

// Read-only: the online book is built from the orders; corrections happen there (refund/cancel).
export default async function PortalOnline({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { year, month } = parseMonth(monthParam(sp));
  const [o, acc] = await Promise.all([getOnlineMonth(year, month), getAccountingSettings()]);
  const m = monthKey(year, month);
  const n = (v: number) => (v ? eur(v) : "");
  return (
    <>
      <Crumbs a="Online-Shop" b="Online-Buch ansehen" />
      <IconBar book="online" m={m}>nur lesen · Verkäufe {eur(o.sales)} € · Erstattungen {eur(o.refunds)} € · Gebühren {eur(o.fees)} €</IconBar>
      <HeadForm kasse={`Online-Shop (${acc.transitAccount})`} mandant={`${acc.client} Greenland Afro Asia Store`} year={year} month={month} opening={eur(o.sales)} closing={eur(o.net)} openingLabel="Verkäufe" closingLabel="Netto-Zufluss" />
      {o.missingFees > 0 && <p className="mx-2 mb-2 border border-[#e8d49a] bg-[#fdf6e0] px-3 py-1.5 text-[#6b5208]">Bei {o.missingFees} Kartenzahlung(en) fehlt die Gebühr des Zahlungsanbieters – bitte mit der Abrechnung von Stripe/PayPal abgleichen.</p>}
      <div className="mx-2 border border-[#c3c3c3]" aria-label={`Online-Shop ${MONATE[month - 1]} ${year}`}>
        <GridScroll className="max-h-[62vh] min-h-[16rem] overflow-auto">
          <table className="stb-grid min-w-[62rem]">
            <thead>
              <tr>
                <th>Datum</th><th>Art</th><th>Bestellung</th><th>Zahlungsart</th>
                <th className="num">Brutto</th><th className="num">Netto 7 %</th><th className="num">USt 7 %</th><th className="num">Netto 19 %</th><th className="num">USt 19 %</th>
                <th className="w-full">Buchungstext</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => (
                <tr key={`${l.orderId}-${l.kind}`} className={l.kind === "sale" ? "" : "dim"}>
                  <td><span>{deDate(l.date)}</span></td>
                  <td><span>{KIND[l.kind]}</span></td>
                  <td><span>{l.order}</span></td>
                  <td><span>{l.method}</span></td>
                  <td className="num"><span>{eur(l.gross)}</span></td>
                  <td className="num"><span>{n(l.net7)}</span></td>
                  <td className="num"><span>{n(l.vat7)}</span></td>
                  <td className="num"><span>{n(l.net19)}</span></td>
                  <td className="num"><span>{n(l.vat19)}</span></td>
                  <td><span>{l.text}</span></td>
                </tr>
              ))}
              {!o.lines.length && <tr><td colSpan={10}><span className="!py-4 text-center text-[#666]">Keine Online-Umsätze in diesem Monat.</span></td></tr>}
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
      </div>
      {o.byMethod.length > 0 && (
        <div className="m-2 max-w-md border border-[#c3c3c3]">
          <p className="stb-bar">Nach Zahlungsart</p>
          <table className="stb-grid">
            <tbody>{o.byMethod.map((b) => <tr key={b.method}><td><span>{b.method}</span></td><td className="num"><span>{eur(b.amount)} €</span></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
