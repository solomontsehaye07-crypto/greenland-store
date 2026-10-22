"use client";

import { useState } from "react";
import { addEntry } from "../actions";

type Template = { id: number; text: string; kind: "in" | "out"; bu: string | null; contra_account: string | null; vat_rate: number | null };

/** "Erfassen": one new cash book line. A template fills the text, the side (in/out) and the accounts. */
export function EntryForm({ templates, today, minDate, m }: { templates: Template[]; today: string; minDate: string; m: string }) {
  const [text, setText] = useState("");
  const [side, setSide] = useState<"in" | "out">("in");
  const [bu, setBu] = useState("");
  const [contra, setContra] = useState("");
  const [vat, setVat] = useState("");
  const [amount, setAmount] = useState("");

  const pick = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return;
    setText(t.text);
    setSide(t.kind);
    setBu(t.bu ?? "");
    setContra(t.contra_account ?? "");
    setVat(t.vat_rate == null ? "" : String(t.vat_rate).replace(".", ","));
  };

  return (
    <form action={addEntry} className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <input type="hidden" name="m" value={m} />
      <input type="hidden" name="income" value={side === "in" ? amount : ""} />
      <input type="hidden" name="expense" value={side === "out" ? amount : ""} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold">New entry</h2>
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Templates">
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(String(t.id))} className={`rounded-full border px-3 py-1 text-xs font-semibold ${text === t.text ? "border-forest bg-forest/10 text-forest" : "border-line hover:border-ink"}`}>
                {t.kind === "in" ? "+ " : "− "}{t.text}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_15rem_9rem_1fr]">
        <div>
          <label htmlFor="cb-date" className="label">Date</label>
          <input id="cb-date" name="date" type="date" defaultValue={today} min={minDate} max={today} required className="input" />
        </div>
        <fieldset>
          <legend className="label">Type</legend>
          <div className="flex rounded-xl border border-line p-1">
            <label className={`flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-semibold ${side === "in" ? "bg-forest text-white" : "text-muted"}`}>
              <input type="radio" name="side" value="in" checked={side === "in"} onChange={() => setSide("in")} className="sr-only" />Money in
            </label>
            <label className={`flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-semibold ${side === "out" ? "bg-terra text-white" : "text-muted"}`}>
              <input type="radio" name="side" value="out" checked={side === "out"} onChange={() => setSide("out")} className="sr-only" />Money out
            </label>
          </div>
        </fieldset>
        <div>
          <label htmlFor="cb-amount" className="label">Amount (€)</label>
          <input id="cb-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" required className="input text-right tabular-nums" />
        </div>
        <div>
          <label htmlFor="cb-text" className="label">Booking text</label>
          <input id="cb-text" name="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required placeholder="e.g. Bargeld Kasse 1789" className="input" />
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-muted">Accounts and note (optional – usually filled in by the Steuerberater)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <div><label htmlFor="cb-bu" className="label">BU key</label><input id="cb-bu" name="bu" value={bu} onChange={(e) => setBu(e.target.value)} maxLength={4} className="input" /></div>
          <div><label htmlFor="cb-contra" className="label">Counter account</label><input id="cb-contra" name="contra" value={contra} onChange={(e) => setContra(e.target.value)} maxLength={9} inputMode="numeric" className="input" /></div>
          <div><label htmlFor="cb-vat" className="label">VAT %</label><input id="cb-vat" name="vat" value={vat} onChange={(e) => setVat(e.target.value)} maxLength={5} inputMode="decimal" className="input" /></div>
          <div><label htmlFor="cb-note" className="label">Note</label><input id="cb-note" name="note" maxLength={300} className="input" /></div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="save_template" className="h-4 w-4 accent-[var(--forest)]" />Also save as a template</label>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">Save entry</button>
        <p className="text-xs text-muted">Saved entries can&apos;t be changed or deleted. Mistakes are corrected with a reversal.</p>
      </div>
    </form>
  );
}
