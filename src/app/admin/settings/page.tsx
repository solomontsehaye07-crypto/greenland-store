import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { enabledProviders } from "@/lib/payments";
import { saveStoreSettings } from "../actions";
import { PasswordForm } from "./password-form";

export default async function Settings() {
  await requireStaff();
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("value").eq("key", "public.store").single();
  const { data: methods } = await sb.from("shipping_methods").select("*").order("sort");
  const v = (data?.value ?? {}) as Record<string, string>;
  const env = [
    ["Stripe", !!process.env.STRIPE_SECRET_KEY],
    ["PayPal", !!process.env.PAYPAL_CLIENT_ID],
    ["Viva Wallet", !!process.env.VIVA_CLIENT_ID],
    ["Email (Resend)", !!process.env.RESEND_API_KEY],
    ["WhatsApp Cloud API", !!process.env.WHATSAPP_TOKEN],
  ] as const;
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Settings</h1>
      <PasswordForm />
      <form action={saveStoreSettings} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <h2 className="text-[0.9375rem] font-semibold sm:col-span-2">Store details (used on refill-order PDFs)</h2>
        {[["name", "Store name"], ["owner", "Owner"], ["street", "Street and number"], ["postal", "Postcode"], ["city", "City"], ["phone", "Phone"], ["whatsapp", "WhatsApp (49…)"], ["email", "Email"], ["vat_id", "VAT ID"]].map(([k, l]) => (
          <div key={k}><label className="label">{l}</label><input name={k} defaultValue={v[k] ?? ""} className="input" /></div>
        ))}
        <button className="btn btn-primary sm:col-span-2">Save</button>
      </form>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-[0.9375rem] font-semibold">Connections</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {env.map(([n, ok]) => (
            <li key={n} className="flex justify-between"><span>{n}</span><span className={ok ? "text-green" : "text-muted"}>{ok ? "Connected" : "Not set – add keys in Vercel"}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Checkout currently offers: {enabledProviders().join(", ")}.</p>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-[0.9375rem] font-semibold">Shipping methods</h2>
        <table className="table mt-3">
          <thead><tr><th>Name</th><th>Type</th><th>Price</th><th>Free from</th><th>Min. order</th></tr></thead>
          <tbody>
            {(methods ?? []).map((m) => (
              <tr key={m.id}><td>{m.name}</td><td>{m.type}</td><td>{m.price} €</td><td>{m.free_from ?? "—"}</td><td>{m.min_order}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Edit prices in Supabase → Table editor → shipping_methods.</p>
      </section>
    </div>
  );
}
