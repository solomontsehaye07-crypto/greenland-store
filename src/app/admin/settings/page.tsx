import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptJson } from "@/lib/commerce";
import { Card, Notice, PageHead } from "@/components/admin/ui";
import { saveReceiptSettings } from "./actions";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const { msg } = await searchParams;
  const { data } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.store", "public.receipt", "private.email"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;
  const v = (get("public.store") ?? {}) as Record<string, string>;
  const r = (get("public.receipt") ?? {}) as Record<string, string>;
  const mail = (await decryptJson<{ resendKey?: string; from?: string; alertTo?: string }>(get("private.email"))) ?? {};
  const envKey = !!process.env.RESEND_API_KEY;
  return (
    <div>
      <PageHead title="Account & receipts" text="Your sign-in, the business details printed on receipts and refill orders, and how emails are sent." />
      <Notice msg={msg} />
      <form action={saveReceiptSettings} className="space-y-5">
        <Card title="Business details" text="Printed on customer receipts and on refill orders to suppliers.">
          <div className="grid gap-4 sm:grid-cols-2">
            {[["name", "Store name"], ["owner", "Owner"], ["street", "Street and number"], ["postal", "Postcode"], ["city", "City"], ["phone", "Phone"], ["whatsapp", "WhatsApp (49…)"], ["email", "Email"], ["vat_id", "VAT ID (USt-IdNr.)"]].map(([k, l]) => (
              <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} name={k} defaultValue={v[k] ?? ""} className="input" /></div>
            ))}
            <div><label className="label" htmlFor="tax_number">Tax number (Steuernummer)</label><input id="tax_number" name="tax_number" defaultValue={r.tax_number ?? ""} className="input" /></div>
          </div>
        </Card>
        <Card title="Digital receipt" text="Every customer gets a PDF receipt by email after ordering, and can download it on their order page.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="receipt_title">Title on the receipt</label><input id="receipt_title" name="receipt_title" defaultValue={r.title ?? ""} placeholder="Rechnung / Beleg" className="input" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="receipt_footer">Footer (up to 3 lines)</label><textarea id="receipt_footer" name="receipt_footer" rows={3} defaultValue={r.footer ?? ""} placeholder={"Vielen Dank für Ihren Einkauf!\nUmtausch innerhalb von 14 Tagen mit Beleg."} className="input" /></div>
          </div>
        </Card>
        <Card title="Sending emails" text="Order confirmations, receipts and stock alerts are sent through Resend (resend.com). Paste your API key yourself; it is stored encrypted.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="resendKey">Resend API key</label>
              <input id="resendKey" name="resendKey" type="password" autoComplete="off" placeholder={mail.resendKey ? "•••••••• (leave empty to keep)" : "re_…"} className="input font-mono text-sm" />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{mail.resendKey ? `saved · ends in ${mail.resendKey.slice(-4)}` : envKey ? "using the key from the server settings" : "not set – emails are not sent"}</span>
                {mail.resendKey && <label className="flex items-center gap-1"><input type="checkbox" name="resendKey__clear" /> remove</label>}
              </div>
            </div>
            <div><label className="label" htmlFor="email_from">Sender</label><input id="email_from" name="email_from" defaultValue={mail.from ?? ""} placeholder="Greenland <bestellung@greenland-afroasia.de>" className="input" /></div>
            <div><label className="label" htmlFor="alert_to">Send new-order and stock alerts to</label><input id="alert_to" name="alert_to" type="email" defaultValue={mail.alertTo ?? ""} className="input" /></div>
          </div>
        </Card>
        <button className="btn btn-primary px-6">Save</button>
      </form>
      <div className="mt-8"><PasswordForm /></div>
    </div>
  );
}
