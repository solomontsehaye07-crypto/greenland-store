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
  "id" | "sku" | "slug" | "title" | "brand" | "price" | "compare_at_price" | "image_url" | "size_qty" | "size_unit" | "stock" | "is_frozen" | "age_restricted" | "weight_g" | "category_id"
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
