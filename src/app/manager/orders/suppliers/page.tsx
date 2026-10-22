import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { SupplierBadges, SupplierTypePicker } from "@/components/supplier-badges";
import { SendPanel } from "@/app/admin/purchase-orders/[id]/send-panel";
import { Msg, OrdersNav, BackButton } from "../../ui";
import { QtyField } from "@/components/qty-field";
import { addSupplier, refillAdd, refillFillLow, refillMessage, refillQty, refillRepeatLast } from "../../actions";
import { supplierInsights, type SupplierInsight } from "@/lib/purchasing";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";
import { LiveSearchInput } from "@/components/live-search-input";

export const dynamic = "force-dynamic";

// Ordering from a supplier in three short steps, one thing per screen:
//   1. pick a supplier        /manager/orders/suppliers
//   2. add products (tabs)    ?s=ID&tab=low|before|search
//   3. review & send          ?s=ID&view=list
// A bar at the bottom always shows the list and leads to step 3, so nobody has to scroll to find it.

type Sup = { id: number; name: string; email: string | null; whatsapp: string | null; phone: string | null; preferred_channel: string; specialties: string[]; address: string | null; website: string | null; country: string | null };
type Item = { id: number; product_id: number; qty: number; unit_cost: number | null; products: { title: string; image_url: string | null; stock: number } };
type Prod = { id: number; title: string; image_url: string | null; stock: number; reorder_point: number; reorder_qty: number; supplier_id: number | null };

const BASE = "/manager/orders/suppliers";

export default async function SupplierOrders({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; msg?: string; new?: string; view?: string; tab?: string; find?: string }> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const sp = await searchParams;
  const { q = "", msg, find = "" } = sp;
  const sb = supabaseAdmin();
  const supplierId = Number(sp.s) || 0;
  const [{ data: sups }, { data: drafts }, { data: open }] = await Promise.all([
    sb.from("suppliers").select("id, name, email, whatsapp, phone, preferred_channel, specialties, address, website, country").eq("active", true).order("name"),
    sb.from("purchase_orders").select("id, supplier_id, purchase_order_items(id)").eq("status", "draft").eq("kind", "refill"),
    sb
      .from("purchase_orders")
      .select("id, number, status, request_kind, sent_at, quoted_at, suppliers(name)")
      .eq("kind", "refill")
      .in("status", ["sent", "quoted", "confirmed"])
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);
  const onList = new Map<number, number>();
  for (const d of drafts ?? []) onList.set(d.supplier_id, (onList.get(d.supplier_id) ?? 0) + (d.purchase_order_items as unknown[]).length);
  const sup = (sups ?? []).find((x) => x.id === supplierId) as Sup | undefined;

  // ---------- step 0: new supplier ----------
  if (sp.new || !sups?.length) return <NewSupplier msg={msg} canCancel={!!sups?.length} />;

  // ---------- step 1: pick a supplier ----------
  if (!sup) {
    const f = find.trim().toLowerCase();
    const list = (sups as Sup[]).filter((x) => !f || x.name.toLowerCase().includes(f));
    return (
      <div>
        <OrdersNav active="suppliers" />
        <Msg msg={msg} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Order from suppliers</h1>
          <Link href={`${BASE}?new=1`} className="btn btn-ghost shrink-0 px-3 text-sm font-semibold">+ New</Link>
        </div>
        <OpenRequests rows={(open ?? []) as unknown as OpenRow[]} />
        <form action={BASE} className="mt-3">
          <input name="find" defaultValue={find} type="search" placeholder="Find a supplier" aria-label="Find a supplier" className="input" />
        </form>
        <ul className="mt-3 space-y-2">
          {list.map((x) => {
            const n = onList.get(x.id) ?? 0;
            return (
              <li key={x.id}>
                <Link href={`${BASE}?s=${x.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 active:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold" data-no-translate>{x.name}</span>
                    <SupplierBadges types={x.specialties} compact className="mt-1 flex" />
                  </span>
                  {n > 0 && <span className="shrink-0 rounded-full bg-[#1c4c86] px-2.5 py-1 text-xs font-bold text-white">{n} on list</span>}
                  <span aria-hidden className="text-2xl text-muted">›</span>
                </Link>
              </li>
            );
          })}
          {!list.length && <li className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">No supplier matches “{find}”.</li>}
        </ul>
      </div>
    );
  }

  // ---------- data for steps 2 and 3 ----------
  const { data: po } = await sb.from("purchase_orders").select("id, number, message, request_kind").eq("supplier_id", sup.id).eq("status", "draft").eq("kind", "refill").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const items: Item[] = po ? (((await sb.from("purchase_order_items").select("id, product_id, qty, unit_cost, products(title, image_url, stock)").eq("purchase_order_id", po.id).order("id")).data ?? []) as unknown as Item[]) : [];
  const qtyOf = new Map(items.map((i) => [i.product_id, i.qty]));
  const units = items.reduce((t, i) => t + i.qty, 0);
  const value = items.reduce((t, i) => t + i.qty * (Number(i.unit_cost) || 0), 0);
  const view = sp.view === "list" ? "list" : "add";
  const keep = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="supplier_id" value={sup.id} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="tab" value={sp.tab ?? ""} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  const header = (extra?: React.ReactNode) => (
    <div className="sticky top-[calc(57px+env(safe-area-inset-top))] z-10 -mx-4 border-b border-line bg-[var(--paper)]/95 px-4 pb-2 pt-1 backdrop-blur">
      <div className="flex items-center gap-2">
        <BackButton href={view === "list" ? `${BASE}?s=${sup.id}` : BASE} label={view === "list" ? "Back to adding products" : "Back to all suppliers"} />
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer list-none">
            <span className="block truncate text-base font-bold" data-no-translate>{sup.name}</span>
            <span className="text-xs text-muted">{view === "list" ? "Review & ask for prices" : "Add products"} · tap for contact</span>
          </summary>
          <div className="mt-2 space-y-1 rounded-xl border border-line bg-white p-3 text-sm" data-no-translate>
            <SupplierBadges types={sup.specialties} className="flex" />
            {sup.address && <p>{sup.address}{sup.country ? ` (${sup.country})` : ""}</p>}
            {sup.phone && <p><a href={`tel:${sup.phone}`} className="underline">{sup.phone}</a></p>}
            {sup.email && <p><a href={`mailto:${sup.email}`} className="underline">{sup.email}</a></p>}
            {sup.website && <p><a href={sup.website} target="_blank" rel="noreferrer" className="underline">{sup.website.replace(/^https?:\/\//, "")}</a></p>}
          </div>
        </details>
      </div>
      {extra}
    </div>
  );

  // ---------- step 3: review & send ----------
  if (view === "list") {
    return (
      <div className="pb-8">
        {header()}
        <div className="mt-3"><Msg msg={msg} /></div>
        {items.length ? (
          <>
            <p className="mt-3 text-sm font-semibold">{items.length} products · {units} units{value > 0 ? ` · about ${money(value)}` : ""}</p>
            <ul className="mt-2 divide-y divide-line rounded-2xl border-2 border-line bg-white">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3 pl-3 pr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.products.image_url ? <img src={i.products.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line bg-white object-contain" /> : <span className="h-14 w-14 shrink-0 rounded-xl bg-surface" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-base font-semibold leading-snug text-ink" data-no-translate>{i.products.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{i.products.stock} in stock</p>
                    <div className="mt-2">
                      <QtyField action={refillQty} qty={i.qty} label={i.products.title} compact>{keep({ item_id: String(i.id) })}</QtyField>
                    </div>
                  </div>
                  <form action={refillQty} className="self-start">
                    {keep({ item_id: String(i.id), qty: "0" })}
                    <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-terra" aria-label={`Remove ${i.products.title}`} title="Remove">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <Link href={`${BASE}?s=${sup.id}`} className="btn btn-ghost mt-3 w-full font-semibold">+ Add more products</Link>
            <details className="mt-4 rounded-2xl border border-line bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold">Message to the supplier (optional)</summary>
              <form action={refillMessage} className="mt-2 space-y-2">
                {keep({ po_id: String(po!.id) })}
                <textarea name="message" rows={3} defaultValue={po!.message ?? ""} className="input" placeholder="e.g. Please deliver by Friday morning." aria-label="Message to the supplier" />
                <button className="btn btn-ghost w-full">Save message</button>
              </form>
            </details>
            <div className="mt-4">
              <SendPanel poId={po!.id} hasEmail={!!sup.email} hasWhatsApp={!!(sup.whatsapp || sup.phone)} preferred={sup.preferred_channel} status="draft" email={sup.email} whatsapp={sup.whatsapp || sup.phone} quote={po!.request_kind === "quote"} next={`${BASE}/offer/${po!.id}`} />
            </div>
            <Link href={`${BASE}/pdf/${po!.id}?back=${encodeURIComponent(`${BASE}?s=${sup.id}&view=list`)}`} className="btn btn-ghost mt-3 w-full font-semibold">See the PDF first</Link>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm text-muted">The list is empty.</p>
            <Link href={`${BASE}?s=${sup.id}`} className="btn btn-primary mt-4">Add products</Link>
          </div>
        )}
      </div>
    );
  }

  // ---------- step 2: add products ----------
  const [ins, { data: mine }, { count: sentBefore }] = await Promise.all([
    supplierInsights(sup.id),
    sb.from("products").select("id, title, image_url, stock, reorder_point, reorder_qty, supplier_id").eq("supplier_id", sup.id).eq("status", "active").order("stock"),
    sb.from("purchase_orders").select("id", { count: "exact", head: true }).eq("supplier_id", sup.id).not("status", "in", "(draft,cancelled)"),
  ]);
  const low = ((mine ?? []) as Prod[]).filter((p) => (p.stock ?? 0) <= (p.reorder_point ?? 0));
  const before: SupplierInsight[] = ins.filter((i) => i.times > 0).sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 30);
  const tab = sp.tab === "low" || sp.tab === "before" || sp.tab === "search" ? sp.tab : low.length ? "low" : before.length ? "before" : "search";

  let found: Prod[] = [];
  if (tab === "search") {
    const term = q.trim().replace(/[%,()]/g, " ");
    let pq = sb.from("products").select("id, title, image_url, stock, reorder_point, reorder_qty, supplier_id").neq("status", "draft").order("title").limit(50);
    if (term) pq = pq.or(`title.ilike.%${term}%,sku.ilike.%${term}%,title_de.ilike.%${term}%`);
    else {
      const { data: linked } = await sb.from("supplier_products").select("product_id").eq("supplier_id", sup.id);
      const ids = (linked ?? []).map((r) => r.product_id);
      pq = ids.length ? pq.in("id", ids.slice(0, 400)) : pq.eq("supplier_id", sup.id);
    }
    found = ((await pq).data ?? []) as Prod[];
  }
  const supName = (id: number | null) => (sups ?? []).find((x) => x.id === id)?.name;

  const Row = ({ id, title, image, stock, reorder, sub, addQty }: { id: number; title: string; image: string | null; stock: number; reorder: number; sub?: React.ReactNode; addQty?: number }) => {
    const has = qtyOf.get(id);
    return (
      <li className="flex items-center gap-3 px-3 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-surface" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug" data-no-translate>{title}</p>
          <p className="mt-0.5 text-xs text-muted">
            <b className={stock <= reorder ? "text-terra" : ""}>{stock}</b> in stock{sub}
            {has ? <b className="ml-1 text-forest">· ✓ {has} on list</b> : null}
          </p>
        </div>
        <form action={refillAdd}>
          {keep({ product_id: String(id), ...(addQty ? { qty: String(addQty) } : {}) })}
          <button className={`h-12 min-w-14 rounded-xl px-3 text-base font-bold ${has ? "border-2 border-forest text-forest" : "bg-forest text-white"}`} aria-label={`Add ${addQty ?? ""} ${title}`}>
            {addQty ? `+${addQty}` : has ? "+1" : "+ Add"}
          </button>
        </form>
      </li>
    );
  };

  const tabs: [string, string, number | null][] = [
    ["low", "Running low", low.length],
    ["before", "Ordered before", before.length],
    ["search", "Search", null],
  ];

  return (
    <div className="pb-28">
      {header(
      <nav aria-label="Ways to add products" className="mt-2">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
          {tabs.map(([k, label, n]) => (
            <Link
              key={k}
              href={`${BASE}?s=${sup.id}&tab=${k}`}
              aria-current={tab === k ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-1 text-center text-sm font-semibold ${tab === k ? "mt-c mt-stock2" : "text-ink"}`}
            >
              {label}
              {n ? <span className={`rounded-full px-1.5 text-xs ${tab === k ? "bg-white text-[#1c4c86]" : "bg-[#1c4c86] text-white"}`}>{n}</span> : null}
            </Link>
          ))}
        </div>
      </nav>
      )}
      <div className="mt-2"><Msg msg={msg} /></div>

      {tab === "low" &&
        (low.length ? (
          <>
            <form action={refillFillLow} className="mt-2">
              {keep()}
              <button className="mt-c mt-stock flex min-h-14 w-full items-center justify-center rounded-2xl px-4 text-base font-bold">Add all {low.length} at once</button>
            </form>
            <ul className="mt-3 divide-y divide-line rounded-2xl border-2 border-line bg-white">
              {low.map((p) => (
                <Row key={p.id} id={p.id} title={p.title} image={p.image_url} stock={p.stock} reorder={p.reorder_point} addQty={Math.max(1, (p.reorder_qty || 0) + (p.reorder_point || 0) - (p.stock || 0))} />
              ))}
            </ul>
          </>
        ) : (
          <Empty text="Nothing you usually order here is running low." />
        ))}

      {tab === "before" &&
        (before.length ? (
          <>
            {(sentBefore ?? 0) > 0 && (
              <form action={refillRepeatLast} className="mt-2">
                {keep()}
                <button className="mt-c mt-stock3 flex min-h-14 w-full items-center justify-center rounded-2xl px-4 text-base font-bold">Repeat the last order</button>
              </form>
            )}
            <ul className="mt-3 divide-y divide-line rounded-2xl border-2 border-line bg-white">
              {before.map((b) => {
                const usual = Math.max(1, Math.round(b.qty / b.times));
                return <Row key={b.product_id} id={b.product_id} title={b.title} image={b.image_url} stock={b.stock} reorder={b.reorder_point} addQty={usual} sub={<> · usually {usual}</>} />;
              })}
            </ul>
          </>
        ) : (
          <Empty text="Nothing ordered from this supplier yet. After your first order, earlier items show up here." />
        ))}

      {tab === "search" && (
        <>
          <form action={BASE} className="mt-2 flex gap-2">
            <input type="hidden" name="s" value={sup.id} />
            <input type="hidden" name="tab" value="search" />
            <LiveSearchInput name="q" defaultValue={q} type="search" placeholder="Product name or SKU" aria-label="Search products" className="input flex-1 text-base" />
            <button className="btn btn-primary px-5">Find</button>
          </form>
          {!q && <p className="mt-2 text-xs text-muted">Showing products {sup.name} sells. Search to find any product.</p>}
          {found.length ? (
            <ul className="mt-3 divide-y divide-line rounded-2xl border-2 border-line bg-white">
              {found.map((p) => (
                <Row
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  image={p.image_url}
                  stock={p.stock}
                  reorder={p.reorder_point}
                  sub={p.supplier_id && p.supplier_id !== sup.id ? <> · usually from <span data-no-translate>{supName(p.supplier_id)}</span></> : null}
                />
              ))}
            </ul>
          ) : (
            <Empty text={q ? "No products found." : "No products are linked to this supplier yet. Search to add any product."} />
          )}
        </>
      )}

      {/* always-visible list bar, above the app's tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 px-4 pb-2">
        <Link
          href={`${BASE}?s=${sup.id}&view=list`}
          className={`mx-auto flex min-h-14 max-w-3xl items-center justify-between gap-3 rounded-2xl px-4 shadow-lg ${items.length ? "mt-c mt-stock2" : "border-2 border-line bg-white text-muted"}`}
        >
          <span className="text-base font-bold">🛒 {items.length ? `${items.length} products · ${units} units` : "List is empty"}</span>
          {items.length > 0 && <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-[#1c4c86]">Review & ask ›</span>}
        </Link>
      </div>
    </div>
  );
}

type OpenRow = { id: number; number: number; status: string; request_kind: string; sent_at: string | null; quoted_at: string | null; suppliers: { name: string } | null };

/** Price requests and orders that are under way, most urgent first. */
function OpenRequests({ rows }: { rows: OpenRow[] }) {
  const stage = (r: OpenRow): [number, string, string] =>
    r.request_kind === "quote"
      ? r.status === "quoted" ? [0, "Prices received – check", "mt-c mt-money"] : [2, "Waiting for prices", "mt-c mt-wait"]
      : r.status === "quoted" ? [1, "Accepted – send the order", "mt-c mt-order"] : [3, "Ordered – waiting for delivery", "mt-c mt-stock"];
  const list = rows.map((r) => ({ r, s: stage(r) })).sort((a, b) => a.s[0] - b.s[0]);
  if (!list.length) return null;
  return (
    <section className="mt-4" aria-label="Requests under way">
      <h2 className="text-sm font-bold">Under way</h2>
      <ul className="mt-2 space-y-2">
        {list.map(({ r, s }) => (
          <li key={r.id}>
            <Link href={`${BASE}/offer/${r.id}`} className="flex min-h-16 items-center gap-3 overflow-hidden rounded-2xl border-2 border-line bg-white pr-3 active:bg-surface">
              <span className={`flex w-28 shrink-0 self-stretch items-center px-3 text-xs font-bold leading-tight ${s[2]}`}>{s[1]}</span>
              <span className="min-w-0 flex-1 py-2">
                <span className="block truncate text-base font-semibold" data-no-translate>{r.suppliers?.name}</span>
                <span className="text-xs text-muted">{r.request_kind === "quote" ? "PR" : "PO"}-{r.number}</span>
              </span>
              <span aria-hidden className="text-2xl text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-5 text-sm font-bold">Ask a supplier for prices</h2>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl border border-line bg-white p-5 text-center text-sm text-muted">{text}</p>;
}

function NewSupplier({ msg, canCancel }: { msg?: string; canCancel: boolean }) {
  return (
    <div className="pb-8">
      <OrdersNav active="suppliers" />
      <Msg msg={msg} />
      <div className="flex items-center gap-2">
        {canCancel && <BackButton href={BASE} label="Back to suppliers" />}
        <h1 className="text-lg font-bold">New supplier</h1>
      </div>
      <form action={addSupplier} className="mt-3 space-y-3 rounded-2xl border border-line bg-white p-4">
        <div>
          <label className="label" htmlFor="sup-name">Company name *</label>
          <input id="sup-name" name="name" required className="input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="sup-wa">WhatsApp number</label><input id="sup-wa" name="whatsapp" inputMode="tel" placeholder="+49 …" className="input" /></div>
          <div><label className="label" htmlFor="sup-email">Email</label><input id="sup-email" name="email" type="email" className="input" /></div>
        </div>
        <div>
          <label className="label" htmlFor="sup-pref">Send orders by</label>
          <select id="sup-pref" name="preferred_channel" defaultValue="whatsapp" className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="both">Both</option>
          </select>
        </div>
        <SupplierTypePicker />
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">More details (optional)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="sup-contact">Contact person</label><input id="sup-contact" name="contact_name" className="input" /></div>
            <div><label className="label" htmlFor="sup-phone">Phone</label><input id="sup-phone" name="phone" inputMode="tel" className="input" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="sup-addr">Address</label><input id="sup-addr" name="address" className="input" /></div>
            <div><label className="label" htmlFor="sup-web">Website</label><input id="sup-web" name="website" type="url" placeholder="https://…" className="input" /></div>
            <div><label className="label" htmlFor="sup-lead">Delivers after (days)</label><input id="sup-lead" name="lead_time_days" type="number" min={0} defaultValue={3} className="input" /></div>
          </div>
        </details>
        <button className="btn btn-primary w-full">Add and start the order</button>
      </form>
    </div>
  );
}
