import { unstable_cache } from "next/cache";
import { supabasePublic } from "./supabase";
import type { Category, Product } from "./types";
import { PRODUCT_CARD_FIELDS } from "./types";

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const { data } = await supabasePublic().from("categories").select("*").order("sort");
    return (data ?? []) as Category[];
  },
  ["categories"],
  { revalidate: 300, tags: ["catalog"] }
);

export async function getCategoryTree() {
  const cats = await getCategories();
  const roots = cats.filter((c) => !c.parent_id);
  return roots.map((r) => ({ ...r, children: cats.filter((c) => c.parent_id === r.id) }));
}

export type CardProduct = Pick<
  Product,
  "id" | "sku" | "slug" | "title" | "title_de" | "brand" | "price" | "compare_at_price" | "image_url" | "size_qty" | "size_unit" | "stock" | "is_frozen" | "age_restricted" | "weight_g" | "category_id" | "country" | "featured" | "sale_ends_at" | "qty_discount"
>;

export async function getProductsInCategories(ids: number[], opts: { sort?: string; limit?: number; offset?: number } = {}) {
  let q = supabasePublic()
    .from("products")
    .select(PRODUCT_CARD_FIELDS, { count: "exact" })
    .eq("status", "active")
    .in("category_id", ids);
  if (opts.sort === "price-asc") q = q.order("price", { ascending: true });
  else if (opts.sort === "price-desc") q = q.order("price", { ascending: false });
  else if (opts.sort === "name") q = q.order("title");
  else q = q.order("featured", { ascending: false }).order("id");
  const limit = opts.limit ?? 48;
  q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  const { data, count } = await q;
  return { products: (data ?? []) as CardProduct[], count: count ?? 0 };
}

export async function searchProducts(term: string, limit = 60) {
  const t = term.trim();
  if (!t) return [];
  const { data } = await supabasePublic()
    .from("products")
    .select(PRODUCT_CARD_FIELDS)
    .eq("status", "active")
    .or(`title.ilike.%${t.replace(/[%,()]/g, " ")}%,brand.ilike.%${t.replace(/[%,()]/g, " ")}%,sku.ilike.%${t.replace(/[%,()]/g, " ")}%`)
    .limit(limit);
  return (data ?? []) as CardProduct[];
}

/** All ids of a category plus its subcategories. */
export async function categoryScope(slug: string) {
  const cats = await getCategories();
  const c = cats.find((x) => x.slug === slug);
  if (!c) return null;
  return { category: c, ids: [c.id, ...cats.filter((x) => x.parent_id === c.id).map((x) => x.id)] };
}

const base = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabasePublic().from("products").select(PRODUCT_CARD_FIELDS).eq("status", "active").not("image_url", "is", null).gt("stock", 0) as any;

/** Best sellers by units sold in the last 90 days, topped up with the shop's own recommendations. */
export async function getBestsellers(limit = 10, scopeIds?: number[]): Promise<CardProduct[]> {
  const { data: ranked } = await supabasePublic().rpc("bestseller_ids", { p_limit: 48 });
  const ids = ((ranked ?? []) as { product_id: number }[]).map((r) => r.product_id);
  let out: CardProduct[] = [];
  if (ids.length) {
    let q = base().in("id", ids);
    if (scopeIds) q = q.in("category_id", scopeIds);
    const { data } = await q;
    const byId = new Map(((data ?? []) as CardProduct[]).map((p) => [p.id, p]));
    out = ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit) as CardProduct[];
  }
  if (out.length < limit) {
    let q = base().eq("featured", true);
    if (scopeIds) q = q.in("category_id", scopeIds);
    if (out.length) q = q.not("id", "in", `(${out.map((p) => p.id).join(",")})`);
    const { data } = await q.order("id").limit(limit - out.length);
    out = [...out, ...((data ?? []) as CardProduct[])];
  }
  return out;
}

/** A varied pick: the shop's recommendations first, then one product from as many categories as possible. */
export async function getRecommended(limit = 10, excludeIds: number[] = []): Promise<CardProduct[]> {
  let q = base();
  if (excludeIds.length) q = q.not("id", "in", `(${excludeIds.join(",")})`);
  const { data } = await q.order("featured", { ascending: false }).order("price", { ascending: false }).limit(200);
  const rows = (data ?? []) as CardProduct[];
  const seen = new Set<number | null>();
  const out: CardProduct[] = [];
  for (const p of rows) if (p.featured && out.length < limit) { out.push(p); seen.add(p.category_id); }
  for (const p of rows) if (!out.includes(p) && !seen.has(p.category_id) && out.length < limit) { out.push(p); seen.add(p.category_id); }
  return out;
}

/** PostgREST filter: a product belongs to a country through its own country or a shared one (e.g. Habesha items: Ethiopia and Eritrea). */
export function countryFilter(country: string) {
  const v = country.replace(/[",{}()]/g, "");
  return `country.eq."${v}",also_countries.cs.{"${v}"}`;
}

/** Products for a product row on the home page. A department (parent category) includes its subcategories. */
export async function getRailProducts(source: string, categorySlug: string | undefined, limit = 10, country?: string, ids?: number[]) {
  const n = Math.min(Math.max(limit || 10, 1), 24);
  if (source === "picked") return getPickedProducts(ids ?? [], n);
  const scope = categorySlug ? await categoryScope(categorySlug) : null;
  if (source === "bestsellers") return getBestsellers(n, scope?.ids);
  if (source === "recommended" || source === "featured") {
    if (scope) {
      const { data } = await base().in("category_id", scope.ids).order("featured", { ascending: false }).order("id").limit(n);
      return (data ?? []) as CardProduct[];
    }
    return getRecommended(n);
  }
  let q = base();
  if (scope) q = q.in("category_id", scope.ids);
  if (source === "country" && country) q = q.or(countryFilter(country));
  if (source === "category" && !scope) return [];
  if (source === "sale") q = q.not("compare_at_price", "is", null).order("id");
  else if (source === "newest") q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
  else q = q.order("featured", { ascending: false }).order("id");
  const { data } = await q.limit(n);
  return (data ?? []) as CardProduct[];
}

/** Countries with the number of products in stock, optionally within a category scope. */
export async function getCountryCounts(scopeIds?: number[]) {
  let q = supabasePublic().from("products").select("country, also_countries").eq("status", "active").gt("stock", 0).not("country", "is", null);
  if (scopeIds) q = q.in("category_id", scopeIds);
  const { data } = await q.limit(5000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { country: string; also_countries: string[] | null }[])
    for (const c of new Set([r.country, ...(r.also_countries ?? [])])) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);
}

export interface BrowseOpts { scopeIds?: number[]; country?: string; sort?: string; page?: number; perPage?: number; inStock?: boolean; sale?: boolean }

/** The shop listing with filters: category scope, country, sort, page. */
export async function browseProducts(o: BrowseOpts) {
  const per = o.perPage ?? 36;
  const page = Math.max(1, o.page ?? 1);
  let q = supabasePublic().from("products").select(PRODUCT_CARD_FIELDS, { count: "exact" }).eq("status", "active");
  if (o.scopeIds) q = q.in("category_id", o.scopeIds);
  if (o.country) q = q.or(countryFilter(o.country));
  if (o.inStock) q = q.gt("stock", 0);
  if (o.sale) q = q.not("compare_at_price", "is", null);
  if (o.sort === "price-asc") q = q.order("price", { ascending: true });
  else if (o.sort === "price-desc") q = q.order("price", { ascending: false });
  else if (o.sort === "name") q = q.order("title");
  else if (o.sort === "new") q = q.order("created_at", { ascending: false });
  else q = q.order("featured", { ascending: false }).order("stock", { ascending: false }).order("id");
  const { data, count } = await q.range((page - 1) * per, page * per - 1);
  return { products: (data ?? []) as CardProduct[], count: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / per)) };
}

/** Add-ons for the cart: recommendations from the same departments plus small impulse items, never what is already in the cart. */
export async function getUpsell(cartIds: number[], limit = 8): Promise<CardProduct[]> {
  const ids = cartIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  const not = ids.length ? `(${ids.join(",")})` : null;
  const cats = await getCategories();
  let cartCats: number[] = [];
  if (ids.length) {
    const { data } = await supabasePublic().from("products").select("category_id").in("id", ids);
    cartCats = [...new Set(((data ?? []) as { category_id: number | null }[]).map((r) => r.category_id).filter((x): x is number => !!x))];
  }
  const sameDept = new Set<number>();
  for (const cid of cartCats) {
    const c = cats.find((x) => x.id === cid);
    const root = c?.parent_id ?? c?.id;
    cats.filter((x) => x.parent_id === root || x.id === root).forEach((x) => sameDept.add(x.id));
  }
  const impulse = cats.filter((c) => ["snacks-sweets", "drinks", "spices-seasonings", "sauces-pastes", "soaps"].includes(c.slug)).map((c) => c.id);
  const pick = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>, n: number) => {
    let q = base();
    if (not) q = q.not("id", "in", not);
    const { data } = await build(q).limit(n);
    return (data ?? []) as CardProduct[];
  };
  const [related, small] = await Promise.all([
    sameDept.size ? pick((q) => q.in("category_id", [...sameDept]).eq("featured", true).order("id"), limit) : Promise.resolve([] as CardProduct[]),
    pick((q) => q.in("category_id", impulse).lte("price", 4).order("featured", { ascending: false }).order("price"), limit * 2),
  ]);
  const out: CardProduct[] = [];
  for (const p of [...related, ...small]) if (!out.some((x) => x.id === p.id) && out.length < limit) out.push(p);
  return out;
}

export const getHomeShelves = unstable_cache(
  async () => {
    const sb = supabasePublic();
    const cats = await getCategories();
    const pick = async (slug: string, n = 8) => {
      const c = cats.find((x) => x.slug === slug);
      if (!c) return { category: null, products: [] as CardProduct[] };
      const { data } = await sb
        .from("products")
        .select(PRODUCT_CARD_FIELDS)
        .eq("status", "active")
        .eq("category_id", c.id)
        .not("image_url", "is", null)
        .order("featured", { ascending: false })
        .order("id")
        .limit(n);
      return { category: c, products: (data ?? []) as CardProduct[] };
    };
    const [fufu, spices, hair, coffee, frozen] = await Promise.all([
      pick("flours-fufu"),
      pick("spices-seasonings"),
      pick("hair-care"),
      pick("coffee-ceremony", 4),
      pick("frozen", 4),
    ]);
    return { fufu, spices, hair, coffee, frozen };
  },
  ["home-shelves"],
  { revalidate: 300, tags: ["catalog"] }
);


/** Hand-picked products in the chosen order (hidden products are skipped). */
export async function getPickedProducts(ids: number[], limit = 24): Promise<CardProduct[]> {
  const list = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 48);
  if (!list.length) return [];
  const { data } = await base().in("id", list);
  const byId = new Map(((data ?? []) as CardProduct[]).map((p) => [p.id, p]));
  return list.map((id) => byId.get(id)).filter((p): p is CardProduct => !!p).slice(0, limit);
}

/** Products on offer (offer price below the regular price), biggest discount first. */
export async function getOffers(limit = 12, ids?: number[]): Promise<CardProduct[]> {
  const rows = ids?.length ? await getPickedProducts(ids, 48) : (((await base().not("compare_at_price", "is", null).limit(200)).data ?? []) as CardProduct[]);
  return rows
    .filter((p) => p.compare_at_price && Number(p.compare_at_price) > Number(p.price))
    .sort((a, b) => (ids?.length ? 0 : Number(a.price) / Number(a.compare_at_price) - Number(b.price) / Number(b.compare_at_price)))
    .slice(0, limit);
}
