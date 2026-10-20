import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";
import { decryptJson, getPaymentConfig, type PaymentSecrets } from "@/lib/commerce";
import { Card, Notice, PageHead, Toggle } from "@/components/admin/ui";
import { savePayments } from "../actions";

export const dynamic = "force-dynamic";

const mask = (v?: string) => (v ? `saved · ends in ${v.slice(-4)}` : "not set");

function KeyInput({ name, label, saved, hint }: { name: keyof PaymentSecrets; label: string; saved?: string; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="password" autoComplete="off" spellCheck={false} placeholder={saved ? "•••••••• (leave empty to keep)" : "paste here"} className="input font-mono text-sm" />
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
        <span>{mask(saved)}{hint ? ` · ${hint}` : ""}</span>
        {saved && <label className="flex items-center gap-1"><input type="checkbox" name={`${name}__clear`} className="accent-[var(--terra)]" /> remove</label>}
      </div>
    </div>
  );
}

function Mode({ name, live }: { name: string; live: boolean }) {
  return (
    <div className="flex rounded-full bg-surface p-1 text-xs">
      {[["live", "Live"], ["test", "Test / sandbox"]].map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={(v === "live") === live} className="peer sr-only" />
          <span className="block rounded-full px-3 py-1.5 font-medium text-muted peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm">{l}</span>
        </label>
      ))}
    </div>
  );
}

function Labels({ k, label }: { k: string; label: { de?: string; en?: string } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${k}_label_de`}>Name at checkout (German)</label><input id={`${k}_label_de`} name={`${k}_label_de`} defaultValue={label.de ?? ""} className="input" /></div>
      <div><label className="label" htmlFor={`${k}_label_en`}>Name at checkout (English)</label><input id={`${k}_label_en`} name={`${k}_label_en`} defaultValue={label.en ?? ""} className="input" /></div>
    </div>
  );
}

function Status({ ok, text }: { ok: boolean; text: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${ok ? "bg-forest/10 text-forest" : "bg-surface text-muted"}`}>{text}</span>;
}

export default async function PaymentSettings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const { msg } = await searchParams;
  const cfg = await getPaymentConfig();
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.payments").maybeSingle();
  const stored = (await decryptJson<PaymentSecrets>(data?.value)) ?? {};
  const p = cfg.pub;
  const site = siteUrl();
  const live = (m: "stripe" | "paypal" | "viva") => cfg.online.includes(m);

  return (
    <div>
      <PageHead
        title="Payments"
        text="Switch payment methods on or off and connect your accounts. Keys are stored encrypted and are never shown again after saving. Only you enter them."
      />
      <Notice msg={msg} />
      <form action={savePayments} className="space-y-5 pb-20">
        <Card title="Stripe" text="Cards, Apple Pay, Google Pay, Klarna, SEPA – whatever you switch on in your Stripe dashboard." actions={<Status ok={live("stripe")} text={live("stripe") ? "At checkout" : stored.stripeSecretKey || cfg.secrets.stripeSecretKey ? "Switched off" : "Not connected"} />}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><Toggle name="stripe_enabled" defaultChecked={p.stripe.enabled} label="Offer Stripe at checkout" /><Mode name="stripe_mode" live={p.stripe.live} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <KeyInput name="stripeSecretKey" label="Secret key (sk_live_… or sk_test_…)" saved={stored.stripeSecretKey} hint="Stripe → Developers → API keys" />
              <KeyInput name="stripeWebhookSecret" label="Webhook signing secret (whsec_…)" saved={stored.stripeWebhookSecret} />
            </div>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs">Webhook address for Stripe → Developers → Webhooks: <code className="break-all">{site}/api/webhooks/stripe</code> with the events checkout.session.completed and checkout.session.async_payment_succeeded.</p>
            <Labels k="stripe" label={p.stripe.label} />
          </div>
        </Card>

        <Card title="PayPal" text="Customers pay with their PayPal account." actions={<Status ok={live("paypal")} text={live("paypal") ? "At checkout" : stored.paypalClientId ? "Switched off" : "Not connected"} />}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><Toggle name="paypal_enabled" defaultChecked={p.paypal.enabled} label="Offer PayPal at checkout" /><Mode name="paypal_mode" live={p.paypal.live} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <KeyInput name="paypalClientId" label="Client ID" saved={stored.paypalClientId} hint="developer.paypal.com → Apps & Credentials" />
              <KeyInput name="paypalSecret" label="Secret" saved={stored.paypalSecret} />
            </div>
            <Labels k="paypal" label={p.paypal.label} />
          </div>
        </Card>

        <Card title="Viva Wallet" text="Cards and local payment methods through Viva Smart Checkout." actions={<Status ok={live("viva")} text={live("viva") ? "At checkout" : stored.vivaClientId ? "Switched off" : "Not connected"} />}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><Toggle name="viva_enabled" defaultChecked={p.viva.enabled} label="Offer Viva Wallet at checkout" /><Mode name="viva_mode" live={p.viva.live} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <KeyInput name="vivaClientId" label="Client ID" saved={stored.vivaClientId} />
              <KeyInput name="vivaSecret" label="Client secret" saved={stored.vivaSecret} />
              <KeyInput name="vivaSourceCode" label="Payment source code" saved={stored.vivaSourceCode} />
            </div>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs">In Viva → Sales → Online payments → Websites/Apps, set the Success URL to <code className="break-all">{site}/api/payments/viva/return</code>.</p>
            <Labels k="viva" label={p.viva.label} />
          </div>
        </Card>

        <Card title="Bank transfer in advance (Vorkasse)" text="The customer gets your bank details by email and on the receipt. Mark the order as paid when the money arrives." actions={<Status ok={p.bank.enabled && !!p.bank.iban} text={p.bank.enabled && p.bank.iban ? "At checkout" : "Off"} />}>
          <div className="space-y-4">
            <Toggle name="bank_enabled" defaultChecked={p.bank.enabled} label="Offer bank transfer" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="bank_holder">Account holder</label><input id="bank_holder" name="bank_holder" defaultValue={p.bank.holder} className="input" /></div>
              <div><label className="label" htmlFor="bank_iban">IBAN</label><input id="bank_iban" name="bank_iban" defaultValue={p.bank.iban} autoComplete="off" className="input font-mono" /></div>
              <div><label className="label" htmlFor="bank_bic">BIC</label><input id="bank_bic" name="bank_bic" defaultValue={p.bank.bic} className="input font-mono" /></div>
              <div><label className="label" htmlFor="bank_name">Bank</label><input id="bank_name" name="bank_name" defaultValue={p.bank.bankName} className="input" /></div>
              <div><label className="label" htmlFor="bank_days">Days to pay</label><input id="bank_days" name="bank_days" type="number" min={1} defaultValue={p.bank.days} className="input" /></div>
            </div>
            <Labels k="bank" label={p.bank.label} />
          </div>
        </Card>

        <Card title="Pay on collection (cash or card in the shop)" text="For pickup and your own local delivery." actions={<Status ok={p.cash.enabled} text={p.cash.enabled ? "At checkout" : "Off"} />}>
          <div className="space-y-4">
            <Toggle name="cash_enabled" defaultChecked={p.cash.enabled} label="Offer pay on collection" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle name="cash_pickup" defaultChecked={p.cash.pickup} label="For pickup in the shop" />
              <Toggle name="cash_local" defaultChecked={p.cash.local} label="For local delivery" />
            </div>
            <div className="rounded-xl border border-line p-4">
              <Toggle name="deposit_enabled" defaultChecked={p.deposit.enabled} label="Ask for a deposit online" hint="The customer pays a part online now (with Stripe, PayPal or Viva) and the rest on collection. Protects you against no-shows." />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div><label className="label" htmlFor="deposit_percent">Deposit in % of the order</label><input id="deposit_percent" name="deposit_percent" inputMode="decimal" defaultValue={p.deposit.percent} className="input" /></div>
                <div><label className="label" htmlFor="deposit_fixed">…or a fixed amount (€)</label><input id="deposit_fixed" name="deposit_fixed" inputMode="decimal" defaultValue={p.deposit.fixed || ""} placeholder="uses % when empty" className="input" /></div>
                <div><label className="label" htmlFor="deposit_min">Only for orders from (€)</label><input id="deposit_min" name="deposit_min" inputMode="decimal" defaultValue={p.deposit.minOrder || ""} placeholder="all orders" className="input" /></div>
              </div>
              {p.deposit.enabled && !cfg.online.length && <p className="mt-3 text-sm text-danger">Connect Stripe, PayPal or Viva first – otherwise customers can’t pay a deposit and pay-on-collection is blocked.</p>}
            </div>
            <Labels k="cash" label={p.cash.label} />
          </div>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-6xl items-center gap-4">
            <button className="btn btn-primary px-6">Save payment settings</button>
            <span className="text-xs text-muted">Checkout now offers: {cfg.methods.length ? cfg.methods.join(", ") : "nothing yet"}</span>
          </div>
        </div>
      </form>
    </div>
  );
}
