import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { afterCustomerSignIn, currentCustomer } from "@/lib/customer";
import { getLang } from "@/lib/i18n";
import { money } from "@/lib/format";
import { LoginForm } from "./login-form";
import { ReorderButton } from "./reorder-button";
import { saveCustomerDetails, signOutCustomer } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account", robots: { index: false } };

const STATUS: Record<string, { de: string; en: string }> = {
  pending: { de: "Wartet auf Zahlung", en: "Waiting for payment" },
  paid: { de: "Bezahlt – wird gepackt", en: "Paid – being packed" },
  processing: { de: "Bestätigt", en: "Confirmed" },
  packed: { de: "Gepackt", en: "Packed" },
  shipped: { de: "Unterwegs", en: "On its way" },
  ready_for_pickup: { de: "Abholbereit", en: "Ready for pickup" },
  delivered: { de: "Geliefert", en: "Delivered" },
  cancelled: { de: "Storniert", en: "Cancelled" },
  refunded: { de: "Erstattet", en: "Refunded" },
};

const T = {
  de: { hi: "Hallo", orders: "Deine Bestellungen", none: "Noch keine Bestellungen. Schau dich im Shop um!", details: "Deine Daten", save: "Speichern", saved: "Gespeichert.", reorder: "Nochmal bestellen", added: "In den Warenkorb gelegt", out: "Abmelden", code: "Dein Willkommenscode", codeSub: "10 % auf deine erste Bestellung – einfach an der Kasse eingeben.", view: "Details", marketing: "Angebote und Neuheiten per E-Mail erhalten", shop: "Zum Shop" },
  en: { hi: "Hello", orders: "Your orders", none: "No orders yet. Have a look around the shop!", details: "Your details", save: "Save", saved: "Saved.", reorder: "Reorder", added: "Added to your cart", out: "Sign out", code: "Your welcome code", codeSub: "10 % off your first order – enter it at checkout.", view: "Details", marketing: "Get offers and new products by email", shop: "Go to the shop" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ msg?: string; next?: string; linked?: string }> }) {
  const [{ msg, next, linked }, lang, me] = await Promise.all([searchParams, getLang(), currentCustomer()]);
  if (me && linked) await afterCustomerSignIn(me.id, me.email);
  const t = T[lang];
  if (!me) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoginForm lang={lang} next={next} />
      </div>
    );
  }
  const sb = supabaseAdmin();
  const [{ data: orders }, { data: coupon }] = await Promise.all([
    sb.from("orders").select("id, number, status, total, created_at, fulfillment_type, order_items(title, qty)").eq("customer_id", me.id).order("created_at", { ascending: false }).limit(30),
    sb.from("coupons").select("code, uses_left, expires_at").eq("email", me.email).like("code", "WELCOME-%").maybeSingle(),
  ]);
  const a = me.address ?? {};
  const codeOpen = coupon && coupon.uses_left > 0 && (!coupon.expires_at || new Date(coupon.expires_at) > new Date());
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight">{t.hi}{me.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted" data-no-translate>{me.email}</p>
        </div>
        <form action={signOutCustomer}><button className="btn btn-ghost h-10 text-sm">{t.out}</button></form>
      </div>

      {codeOpen && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-forest p-6 text-white">
          <div>
            <p className="text-sm font-semibold opacity-90">{t.code}</p>
            <p className="display mt-1 text-3xl font-semibold tracking-wide" data-no-translate>{coupon!.code}</p>
            <p className="mt-1 text-sm opacity-90">{t.codeSub}</p>
          </div>
          <Link href="/shop" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-forest">{t.shop}</Link>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-xl font-bold">{t.orders}</h2>
          {orders?.length ? (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => {
                const items = o.order_items as { title: string; qty: number }[];
                return (
                  <li key={o.id} className="rounded-2xl bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">#{o.number} <span className="ml-2 text-sm font-normal text-muted">{date(o.created_at)}</span></p>
                      <p className="font-semibold tabular-nums">{money(Number(o.total))}</p>
                    </div>
                    <p className="mt-1 text-sm text-forest">{STATUS[o.status]?.[lang] ?? o.status}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted" data-no-translate>{items.map((i) => `${i.qty} × ${i.title}`).join(", ")}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {o.status !== "cancelled" && <ReorderButton orderId={o.id} label={t.reorder} done={t.added} />}
                      <Link href={`/order/${o.id}`} className="text-sm font-medium text-forest underline">{t.view}</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl bg-white p-6 text-sm text-muted">{t.none}</p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold">{t.details}</h2>
          <form action={saveCustomerDetails} className="mt-4 space-y-3 rounded-2xl bg-white p-5">
            {msg === "saved" && <p className="text-sm text-forest" role="status">{t.saved}</p>}
            <div>
              <label className="label" htmlFor="ac-name">Name</label>
              <input id="ac-name" name="name" defaultValue={me.full_name ?? ""} autoComplete="name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ac-phone">{lang === "de" ? "Telefon" : "Phone"}</label>
              <input id="ac-phone" name="phone" type="tel" defaultValue={me.phone ?? ""} autoComplete="tel" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ac-street">{lang === "de" ? "Straße und Hausnummer" : "Street and number"}</label>
              <input id="ac-street" name="street" defaultValue={a.street ?? ""} autoComplete="street-address" className="input" />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div>
                <label className="label" htmlFor="ac-postal">PLZ</label>
                <input id="ac-postal" name="postal" defaultValue={a.postal ?? ""} inputMode="numeric" autoComplete="postal-code" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="ac-city">{lang === "de" ? "Ort" : "City"}</label>
                <input id="ac-city" name="city" defaultValue={a.city ?? ""} autoComplete="address-level2" className="input" />
              </div>
            </div>
            <input type="hidden" name="country" value={a.country ?? "DE"} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="marketing" defaultChecked={me.marketing} className="mt-1 accent-[var(--green)]" />
              {t.marketing}
            </label>
            <button className="btn btn-primary w-full">{t.save}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
