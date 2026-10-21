import { saveCustomer } from "./actions";

export type Customer = { id: number; name: string; contact_name: string | null; street: string | null; postal: string | null; city: string | null; country: string; vat_id: string | null; email: string | null; whatsapp: string | null; phone: string | null; discount_pct: number; payment_days: number; notes: string | null };

/** Business customer: shop, restaurant … (name and address go on the invoice). */
export function CustomerForm({ c, back, defaultDays = 14 }: { c?: Customer | null; back?: string; defaultDays?: number }) {
  const f = (k: keyof Customer, label: string, opts: { type?: string; inputMode?: "tel" | "email" | "decimal" | "numeric"; placeholder?: string; auto?: string; span?: boolean } = {}) => (
    <div className={opts.span ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={`bc-${k}`}>{label}</label>
      <input id={`bc-${k}`} name={k} type={opts.type ?? "text"} inputMode={opts.inputMode} placeholder={opts.placeholder} autoComplete={opts.auto} defaultValue={c?.[k] != null ? String(c[k]) : k === "payment_days" ? String(defaultDays) : k === "country" ? "DE" : ""} className="input text-base" />
    </div>
  );
  return (
    <form action={saveCustomer} className="space-y-3 rounded-2xl border-2 border-line bg-white p-4">
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <div>
        <label className="label" htmlFor="bc-name">Company / restaurant name *</label>
        <input id="bc-name" name="name" required defaultValue={c?.name ?? ""} autoComplete="organization" className="input text-base" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {f("contact_name", "Contact person", { auto: "name" })}
        {f("street", "Street and number", { auto: "street-address" })}
        {f("postal", "Postcode", { inputMode: "numeric", auto: "postal-code" })}
        {f("city", "City", { auto: "address-level2" })}
        {f("whatsapp", "WhatsApp", { type: "tel", inputMode: "tel", placeholder: "+49 …" })}
        {f("email", "Email (for invoices)", { type: "email", inputMode: "email" })}
      </div>
      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">More (VAT ID, discount, payment days …)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {f("vat_id", "VAT ID (USt-IdNr.)", { placeholder: "DE…" })}
          {f("country", "Country code", { placeholder: "DE" })}
          {f("discount_pct", "Discount on shop prices (%)", { inputMode: "decimal", placeholder: "0" })}
          {f("payment_days", "Pay within (days)", { inputMode: "numeric" })}
          {f("phone", "Phone", { type: "tel", inputMode: "tel" })}
          {f("notes", "Notes (only for you)", { span: true })}
        </div>
      </details>
      <button className="btn btn-primary min-h-12 w-full text-base font-bold">{back === "new-invoice" ? "Save and start the invoice" : "Save customer"}</button>
    </form>
  );
}
