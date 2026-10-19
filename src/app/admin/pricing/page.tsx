import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/format";
import { getPricingSettings, marginOf, measuredLossByCategory, recommendPrice, ruleFor, type Cat } from "@/lib/pricing";
import { SelectAll } from "@/components/admin/select-all";
import { applyPrices, importCosts, savePricingRules, saveCosts } from "./actions";

export const metadata = { title: "Pricing" };

const VIEWS = [
  ["all", "All"],
  ["nocost", "Cost missing"],
  ["below", "Below target"],
  ["above", "Above recommended"],
  ["ok", "On target"],
] as const;
const PER = 50;
const pct = (x: number) => `${x.toFixed(1).replace(".", ",")} %`;

type Row = {
  id: number; sku: string; title: string; image_url: string | null; category_id: number | null; price: number; cost: number | null; tax: number; stock: number;
  rule: { margin: number; waste: number; from: string }; rec: number | null; margin: number | null; recMargin: number | null; state: "nocost" | "below" | "above" | "ok";
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const view = VIEWS.some(([v]) => v === sp.view) ? sp.view! : "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const cat = sp.cat ? Number(sp.cat) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = supabaseAdmin();
  const [s, { data: catsRaw }, { data: prods }] = await Promise.all([
    getPricingSettings(),
    sb.from("categories").select("id, title, department, parent_id, sort").order("sort"),
    sb.from("products").select("id, sku, title, title_de, image_url, category_id, price, cost_price, tax_rate, stock, status").neq("status", "draft").order("title").limit(5000),
  ]);
  const cats = (catsRaw ?? []) as (Cat & { sort: number })[];
  const measured = await measuredLossByCategory();

  const all: Row[] = (prods ?? []).map((p) => {
    const rule = ruleFor(s, p.category_id, cats, measured);
    const cost = p.cost_price == null ? null : Number(p.cost_price);
    const tax = Number(p.tax_rate);
    const price = Number(p.price);
    const rec = cost && cost > 0 ? recommendPrice(cost, tax, rule, s.rounding) : null;
    const margin = cost && cost > 0 ? marginOf(price, tax, cost, rule.waste) : null;
    const recMargin = rec && cost ? marginOf(rec, tax, cost, rule.waste) : null;
    let state: Row["state"] = "nocost";
    if (rec !== null && margin !== null) state = margin < rule.margin - 0.5 ? "below" : price > rec + 0.005 ? "above" : "ok";
    return { id: p.id, sku: p.sku, title: p.title_de || p.title, image_url: p.image_url, category_id: p.category_id, price, cost, tax, stock: p.stock, rule, rec, margin, recMargin, state };
  });

  const counts = { all: all.length, nocost: 0, below: 0, above: 0, ok: 0 } as Record<string, number>;
  for (const r of all) counts[r.state]++;
  const withCost = all.filter((r) => r.margin !== null);
  const avgMargin = withCost.length ? withCost.reduce((a, r) => a + r.margin!, 0) / withCost.length : null;

  const inCat = (r: Row) => {
    if (!cat) return true;
    const c = cats.find((x) => x.id === r.category_id);
    return r.category_id === cat || c?.parent_id === cat;
  };
  const filtered = all.filter((r) => (view === "all" || r.state === view) && inCat(r) && (!q || r.title.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const rows = filtered.slice((page - 1) * PER, page * PER);
  const qs = (extra: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const merged = { view, q: sp.q, cat: sp.cat, page: String(page), ...extra };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "view" && v === "all") && !(k === "page" && String(v) === "1")) u.set(k, String(v));
    const str = u.toString();
    return `/admin/pricing${str ? `?${str}` : ""}`;
  };
  const here = qs({});
  const subcats = cats.filter((c) => c.parent_id);
  const roots = cats.filter((c) => !c.parent_id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-extrabold">Pricing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Enter what you pay per item (net, without VAT). The tool adds a waste allowance and your target margin, adds VAT and rounds to a shop price. Nothing changes until you apply a recommendation{s.autoApply ? ", except automatic repricing is on" : ""}.
          </p>
        </div>
        <Link href="/admin/finance" className="btn btn-ghost">Profit &amp; loss</Link>
      </header>

      {sp.msg && <p role="status" className="rounded-xl bg-forest/10 px-4 py-3 text-sm font-medium text-forest">{sp.msg}</p>}

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Purchase cost entered" value={`${withCost.length} / ${all.length}`} />
        <Stat label="Below target margin" value={String(counts.below)} tone={counts.below ? "bad" : undefined} />
        <Stat label="Priced above recommendation" value={String(counts.above)} />
        <Stat label="Average margin (where cost known)" value={avgMargin === null ? "–" : pct(avgMargin)} />
      </section>

      <details className="rounded-2xl bg-white p-5" open={withCost.length === 0}>
        <summary className="cursor-pointer text-lg font-bold">Pricing rules</summary>
        <form action={savePricingRules} className="mt-4 space-y-5">
          <input type="hidden" name="return" value={here} />
          <p className="text-sm text-muted">
            Recommended price = cost × (1 + waste) ÷ (1 − margin), plus VAT, rounded up. Margin is the share of the net selling price you keep. Waste covers what spoils or breaks before it is sold.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            <RuleInputs prefix="default" title="Everything else" rule={s.default} />
            {(["food", "beauty", "home"] as const).map((d) => (
              <RuleInputs key={d} prefix={`dept_${d}`} title={{ food: "Food", beauty: "Beauty", home: "Home & Deco" }[d]} rule={s.departments[d]} />
            ))}
          </div>
          <div>
            <h3 className="text-sm font-bold">Category overrides</h3>
            <p className="text-xs text-muted">Leave empty to use the department rule. Measured loss is from the last 90 days of write-offs, once at least 50 € was bought.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2">Category</th><th>Margin %</th><th>Waste %</th><th>Measured loss</th></tr></thead>
                <tbody>
                  {roots.map((r) => (
                    <FragmentRows key={r.id} root={r} subs={subcats.filter((c) => c.parent_id === r.id)} s={s} measured={measured} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="autoApply" defaultChecked={s.autoApply} className="h-4 w-4" /> Reprice automatically when a purchase cost changes</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="useMeasuredLoss" defaultChecked={s.useMeasuredLoss} className="h-4 w-4" /> Use measured loss instead of the waste allowance</label>
            <label className="flex items-center gap-2">Rounding
              <select name="rounding" defaultValue={s.rounding} className="input !w-auto !py-1"><option value="psych">,49 / ,99 endings</option><option value="cent">Exact to the cent</option></select>
            </label>
          </div>
          <button className="btn btn-primary">Save rules</button>
        </form>
      </details>

      <details className="rounded-2xl bg-white p-5">
        <summary className="cursor-pointer text-lg font-bold">Import purchase costs</summary>
        <form action={importCosts} className="mt-4 space-y-3">
          <input type="hidden" name="return" value={here} />
          <label className="label" htmlFor="lines">One product per line: SKU and net cost, separated by a semicolon or tab (copy two columns from Excel).</label>
          <textarea id="lines" name="lines" rows={5} className="input font-mono text-xs" placeholder={"GRL-000013;1,20\nGRL-000088;0,85"} />
          <button className="btn btn-primary">Import costs</button>
        </form>
      </details>

      <section className="rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          {VIEWS.map(([v, label]) => (
            <Link key={v} href={qs({ view: v, page: 1 })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${view === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
              {label} <span className="opacity-70">{counts[v]}</span>
            </Link>
          ))}
          <form className="ml-auto flex flex-wrap gap-2" action="/admin/pricing">
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            <select name="cat" defaultValue={sp.cat ?? ""} className="input !w-auto !py-1.5 text-sm" aria-label="Category">
              <option value="">All categories</option>
              {roots.map((r) => (
                <optgroup key={r.id} label={r.title}>
                  <option value={r.id}>All {r.title}</option>
                  {subcats.filter((c) => c.parent_id === r.id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </optgroup>
              ))}
            </select>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or SKU" className="input !w-48 !py-1.5 text-sm" aria-label="Search" />
            <button className="btn btn-ghost !py-1.5">Filter</button>
          </form>
        </div>

        <form className="mt-4">
          <input type="hidden" name="return" value={here} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="w-8 py-2"><SelectAll /></th>
                  <th>Product</th>
                  <th className="w-28">Cost net €</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Price now</th>
                  <th className="text-right">Margin now</th>
                  <th className="text-right">Target</th>
                  <th className="text-right">Recommended</th>
                  <th className="text-right">Change</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const diff = r.rec !== null ? r.rec - r.price : null;
                  return (
                    <tr key={r.id} className="border-b border-line align-middle">
                      <td className="py-2"><input type="checkbox" name="ids" value={r.id} disabled={r.rec === null} aria-label={`Select ${r.title}`} className="h-4 w-4" /></td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3">
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt="" className="h-9 w-9 rounded-md bg-surface object-cover" loading="lazy" />
                          ) : <span className="h-9 w-9 rounded-md bg-surface" />}
                          <div className="min-w-0">
                            <Link href={`/admin/products/${r.id}`} className="line-clamp-1 font-medium hover:underline">{r.title}</Link>
                            <div className="text-xs text-muted">{r.sku} · stock {r.stock}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <input type="hidden" name={`orig_${r.id}`} value={r.cost ?? ""} />
                        <input name={`cost_${r.id}`} defaultValue={r.cost ?? ""} inputMode="decimal" className="input !py-1 text-right" aria-label={`Cost for ${r.title}`} placeholder="–" />
                      </td>
                      <td className="text-right text-muted">{r.tax} %</td>
                      <td className="text-right font-medium">{money(r.price)}</td>
                      <td className={`text-right ${r.state === "below" ? "font-semibold text-danger" : ""}`}>{r.margin === null ? "–" : pct(r.margin)}</td>
                      <td className="text-right text-xs text-muted" title={`Rule: ${r.rule.from}`}>{r.rule.margin} % <span className="block">+{r.rule.waste} % waste</span></td>
                      <td className="text-right font-semibold">{r.rec === null ? <span className="text-xs font-normal text-muted">enter cost</span> : money(r.rec)}</td>
                      <td className={`text-right ${diff === null ? "" : diff > 0.005 ? "text-forest" : diff < -0.005 ? "text-danger" : "text-muted"}`}>
                        {diff === null ? "" : Math.abs(diff) < 0.005 ? "same" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                      </td>
                      <td className="text-right">
                        {r.rec !== null && Math.abs(r.rec - r.price) >= 0.005 && (
                          <button formAction={applyPrices} name="one" value={r.id} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:border-ink">Apply</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={10} className="py-10 text-center text-muted">No products match.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button formAction={saveCosts} className="btn btn-ghost">Save costs</button>
            <button formAction={applyPrices} className="btn btn-primary">Apply recommended price to selected</button>
            <span className="ml-auto text-xs text-muted">Page {page} of {pages} · {filtered.length} products</span>
            {page > 1 && <Link href={qs({ page: page - 1 })} className="btn btn-ghost !py-1.5">Previous</Link>}
            {page < pages && <Link href={qs({ page: page + 1 })} className="btn btn-ghost !py-1.5">Next</Link>}
          </div>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}

function RuleInputs({ prefix, title, rule }: { prefix: string; title: string; rule?: { margin: number; waste: number } }) {
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Margin %<input name={`${prefix}_margin`} defaultValue={rule?.margin ?? ""} inputMode="decimal" className="input mt-1 !py-1" /></label>
        <label className="text-xs text-muted">Waste %<input name={`${prefix}_waste`} defaultValue={rule?.waste ?? ""} inputMode="decimal" className="input mt-1 !py-1" /></label>
      </div>
    </fieldset>
  );
}

function FragmentRows({ root, subs, s, measured }: { root: Cat; subs: Cat[]; s: Awaited<ReturnType<typeof getPricingSettings>>; measured: Map<number, number> }) {
  return (
    <>
      <tr className="border-b border-line bg-surface/60"><td colSpan={4} className="py-1.5 pl-1 text-xs font-bold">{root.title}</td></tr>
      {subs.map((c) => {
        const o = s.categories[String(c.id)];
        const m = measured.get(c.id);
        return (
          <tr key={c.id} className="border-b border-line">
            <td className="py-1.5">{c.title}</td>
            <td><input name={`cat_${c.id}_margin`} defaultValue={o?.margin ?? ""} inputMode="decimal" className="input !w-20 !py-1" aria-label={`${c.title} margin`} /></td>
            <td><input name={`cat_${c.id}_waste`} defaultValue={o?.waste ?? ""} inputMode="decimal" className="input !w-20 !py-1" aria-label={`${c.title} waste`} /></td>
            <td className="text-xs text-muted">{m === undefined ? "not enough data" : pct(m)}</td>
          </tr>
        );
      })}
    </>
  );
}
