import "server-only";
import * as XLSX from "xlsx";
import type { AccountingSettings, OnlineMonth, ShopMonth } from "./cashbook";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const pad = (n: number) => String(n).padStart(2, "0");
const deDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const EUR = '#,##0.00 "€";-#,##0.00 "€"';

function money(ws: XLSX.WorkSheet, cols: number[], fromRow: number) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = fromRow; r <= range.e.r; r++)
    for (const c of cols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number") cell.z = EUR;
    }
}

/** Excel file of the shop cash book, laid out like the Agenda Kassenbuch. */
export function shopXlsx(m: ShopMonth, store: { name: string }, acc: AccountingSettings): Uint8Array {
  const head = [
    [`${store.name} – Kassenbuch`],
    [`Kasse ${acc.cashAccount}`, "", `Monat: ${MONTHS[m.month - 1]} ${m.year}`],
    ["Anfangsbestand", m.opening, "", "Endbestand", m.closing],
    ["Summe Einnahmen", m.income, "", "Summe Ausgaben", m.expense],
    [m.closedAt ? `Monat abgeschlossen am ${deDate(m.closedAt.slice(0, 10))}` : "Monat noch offen"],
    [],
    ["Lfd. Nr.", "Einnahme", "Ausgabe", "Lfd. Bestand", "Datum", "Buchungstext", "BU", "Gegenkonto", "USt %", "Notiz", "Storno zu"],
  ];
  const byId = new Map(m.entries.map((e) => [e.id, e.no]));
  const rows = m.entries.map((e) => [
    e.no,
    e.income || null,
    e.expense || null,
    e.balance,
    deDate(e.entry_date),
    e.text,
    e.bu ?? "",
    e.contra_account ?? "",
    e.vat_rate ?? "",
    e.note ?? "",
    e.storno_of ? byId.get(e.storno_of) ?? String(e.storno_of) : "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...head, ...rows]);
  ws["!cols"] = [14, 12, 12, 13, 12, 32, 6, 12, 7, 28, 12].map((w) => ({ wch: w }));
  money(ws, [1, 2, 3], 7);
  money(ws, [1, 4], 2);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Kassenbuch ${pad(m.month)}-${m.year}`);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Excel file of the online shop: every sale, refund and fee, plus a summary sheet. */
export function onlineXlsx(m: OnlineMonth, store: { name: string }): Uint8Array {
  const KIND = { sale: "Verkauf", refund: "Erstattung", fee: "Gebühr" } as const;
  const lines = XLSX.utils.aoa_to_sheet([
    [`${store.name} – Online-Shop – ${MONTHS[m.month - 1]} ${m.year}`],
    [],
    ["Datum", "Art", "Bestellung", "Zahlungsart", "Brutto", "Netto 7 %", "USt 7 %", "Netto 19 %", "USt 19 %", "Buchungstext"],
    ...m.lines.map((l) => [deDate(l.date), KIND[l.kind], l.order, l.method, l.gross, l.net7 || null, l.vat7 || null, l.net19 || null, l.vat19 || null, l.text]),
  ]);
  lines["!cols"] = [12, 11, 11, 18, 12, 12, 11, 12, 11, 36].map((w) => ({ wch: w }));
  money(lines, [4, 5, 6, 7, 8], 3);
  const summary = XLSX.utils.aoa_to_sheet([
    [`Zusammenfassung ${MONTHS[m.month - 1]} ${m.year}`],
    [],
    ["Umsatz (brutto)", m.sales],
    ["Erstattungen / Stornos", -m.refunds],
    ["Gebühren Zahlungsanbieter", -m.fees],
    ["Ergebnis", m.net],
    [],
    ["Zahlungsart", "Betrag"],
    ...m.byMethod.map((x) => [x.method, x.amount]),
    [],
    ["Umsatzsteuer", "Netto", "USt"],
    ["7 %", m.vat.net7, m.vat.vat7],
    ["19 %", m.vat.net19, m.vat.vat19],
    ...(m.missingFees ? [[], [`Hinweis: Bei ${m.missingFees} Kartenzahlung(en) fehlt die Gebühr – bitte mit der Abrechnung des Anbieters abgleichen.`]] : []),
  ]);
  summary["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }];
  money(summary, [1, 2], 2);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summary, "Zusammenfassung");
  XLSX.utils.book_append_sheet(wb, lines, "Buchungen");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// ---------------- DATEV booking batch (EXTF 700, "Buchungsstapel") ----------------

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const amt = (n: number) => Math.abs(n).toFixed(2).replace(".", ",");
const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const clean = (s: string, max: number) => s.replace(/[\r\n;]+/g, " ").slice(0, max);

function datevHeader(acc: AccountingSettings, year: number, month: number, label: string) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}000`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    q("EXTF"), 700, 21, q("Buchungsstapel"), 13, stamp, "", q(""), q(""), q(""),
    acc.consultant || "", acc.client || "", `${year}0101`, acc.cashAccount.length || 4,
    `${year}${pad(month)}01`, `${year}${pad(month)}${pad(last)}`, q(clean(label, 30)), q(""), 1, 0, 0, q("EUR"), "", q(""), "", "", q(acc.chart === "SKR04" ? "04" : "03"), "", "", q(""), q(""),
  ].join(";");
}

const COLS = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext"];

type Row = { amount: number; sh: "S" | "H"; konto: string; gegen: string; bu?: string | null; date: string; beleg: string; text: string };
const row = (r: Row) => [amt(r.amount), q(r.sh), q("EUR"), "", "", q(""), r.konto, r.gegen, q(r.bu ?? ""), ddmm(r.date), q(clean(r.beleg, 36)), q(""), "", q(clean(r.text, 60))].join(";");

/** DATEV text files are read as Windows-1252; characters outside it become "?". */
function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  const map: Record<string, number> = { "€": 0x80, "–": 0x96, "„": 0x84, "“": 0x93 };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 256 ? c : map[text[i]] ?? 63;
  }
  return out;
}

export function shopDatev(m: ShopMonth, acc: AccountingSettings): Uint8Array {
  const rows = m.entries.map((e) =>
    row({
      amount: e.income || e.expense,
      sh: e.income ? "S" : "H",
      konto: acc.cashAccount,
      gegen: e.contra_account ?? "",
      bu: e.bu,
      date: e.entry_date,
      beleg: e.no,
      text: e.text,
    })
  );
  return latin1([datevHeader(acc, m.year, m.month, `Kasse ${pad(m.month)}/${m.year}`), COLS.map(q).join(";"), ...rows].join("\r\n") + "\r\n");
}

export function onlineDatev(m: OnlineMonth, acc: AccountingSettings): Uint8Array {
  const out: string[] = [];
  for (const l of m.lines) {
    const money = l.method === "Bar bei Abholung" ? acc.cashAccount : acc.transitAccount;
    const beleg = `B${l.order}`;
    if (l.kind === "fee") {
      out.push(row({ amount: l.gross, sh: "S", konto: acc.feeAccount, gegen: acc.transitAccount, date: l.date, beleg, text: l.text }));
      continue;
    }
    const sh = l.kind === "sale" ? "S" : "H";
    const g7 = Math.abs(l.net7 + l.vat7);
    const g19 = Math.abs(l.net19 + l.vat19);
    if (g7) out.push(row({ amount: g7, sh, konto: money, gegen: acc.revenue7, date: l.date, beleg, text: `${l.text} 7 %` }));
    if (g19) out.push(row({ amount: g19, sh, konto: money, gegen: acc.revenue19, date: l.date, beleg, text: `${l.text} 19 %` }));
  }
  return latin1([datevHeader(acc, m.year, m.month, `Online ${pad(m.month)}/${m.year}`), COLS.map(q).join(";"), ...out].join("\r\n") + "\r\n");
}
