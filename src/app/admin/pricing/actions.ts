"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { applyRecommended, getPricingSettings, type PricingSettings, type Rule } from "@/lib/pricing";

const n = (v: FormDataEntryValue | null) => {
  if (v === null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};

function back(fd: FormData, msg: string) {
  const ret = String(fd.get("return") || "/admin/pricing");
  const url = new URL(ret, "http://x");
  url.searchParams.set("msg", msg);
  redirect(url.pathname + url.search);
}

export async function savePricingRules(fd: FormData) {
  await assertStaff();
  const cur = await getPricingSettings();
  const rule = (prefix: string): Rule | null => {
    const m = n(fd.get(`${prefix}_margin`));
    const w = n(fd.get(`${prefix}_waste`));
    if (m === null && w === null) return null;
    return { margin: Math.min(Math.max(m ?? 0, 0), 90), waste: Math.min(Math.max(w ?? 0, 0), 80) };
  };
  const next: PricingSettings = {
    ...cur,
    autoApply: fd.get("autoApply") === "on",
    useMeasuredLoss: fd.get("useMeasuredLoss") === "on",
    rounding: fd.get("rounding") === "cent" ? "cent" : "psych",
    default: rule("default") ?? cur.default,
    departments: {},
    categories: {},
  };
  for (const d of ["food", "beauty", "home"]) {
    const r = rule(`dept_${d}`);
    if (r) next.departments[d] = r;
  }
  for (const key of fd.keys()) {
    const m = key.match(/^cat_(\d+)_margin$/);
    if (!m) continue;
    const r = rule(`cat_${m[1]}`);
    if (r) next.categories[m[1]] = r;
  }
  await supabaseAdmin().from("settings").upsert({ key: "admin.pricing", value: next });
  revalidatePath("/admin/pricing");
  back(fd, "Pricing rules saved.");
}

/** Save edited purchase costs; with automatic repricing on, the new prices follow right away. */
export async function saveCosts(fd: FormData) {
  const user = await assertStaff();
  const sb = supabaseAdmin();
  const changed: number[] = [];
  for (const [key, val] of fd.entries()) {
    const m = key.match(/^cost_(\d+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const next = n(val);
    const orig = n(fd.get(`orig_${id}`));
    if (next === orig || (next !== null && next < 0)) continue;
    const { error } = await sb.from("products").update({ cost_price: next }).eq("id", id);
    if (!error) changed.push(id);
  }
  const s = await getPricingSettings();
  let repriced = 0;
  if (s.autoApply && changed.length) {
    repriced = await applyRecommended(changed, user.id, "auto (cost change)");
    revalidateTag("catalog");
  }
  revalidatePath("/admin/pricing");
  back(fd, `${changed.length} cost${changed.length === 1 ? "" : "s"} saved${s.autoApply ? `, ${repriced} price${repriced === 1 ? "" : "s"} adjusted automatically` : ""}.`);
}

/** Accept recommendations: one product (button "one") or every ticked product. */
export async function applyPrices(fd: FormData) {
  const user = await assertStaff();
  const one = fd.get("one");
  const ids = (one ? [one] : fd.getAll("ids")).map(Number).filter((x) => Number.isInteger(x) && x > 0);
  if (!ids.length) back(fd, "Tick at least one product first.");
  const changed = await applyRecommended(ids, user.id);
  revalidateTag("catalog");
  revalidatePath("/admin/pricing");
  back(fd, `${changed} price${changed === 1 ? "" : "s"} updated.`);
}

/** Paste "SKU;cost" lines (from a supplier invoice or spreadsheet) to set many purchase costs at once. */
export async function importCosts(fd: FormData) {
  const user = await assertStaff();
  const sb = supabaseAdmin();
  const lines = String(fd.get("lines") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pairs: [string, number][] = [];
  for (const l of lines) {
    let parts = l.split(/[;\t]/);
    if (parts.length < 2) parts = l.split(/,(?=\s*\d)/);
    if (parts.length < 2) continue;
    const cost = n(parts[parts.length - 1]);
    const sku = parts[0].trim();
    if (sku && cost !== null && cost >= 0) pairs.push([sku, cost]);
  }
  const ids: number[] = [];
  let missing = 0;
  for (const [sku, cost] of pairs) {
    const { data } = await sb.from("products").update({ cost_price: cost }).eq("sku", sku).select("id");
    if (data?.length) ids.push(...data.map((r) => r.id as number));
    else missing++;
  }
  const s = await getPricingSettings();
  let repriced = 0;
  if (s.autoApply && ids.length) {
    repriced = await applyRecommended(ids, user.id, "auto (cost import)");
    revalidateTag("catalog");
  }
  revalidatePath("/admin/pricing");
  back(fd, `${ids.length} costs imported${missing ? `, ${missing} SKU${missing === 1 ? "" : "s"} not found` : ""}${s.autoApply ? `, ${repriced} prices adjusted` : ""}.`);
}
