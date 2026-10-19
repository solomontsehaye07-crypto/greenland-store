import { supabasePublic } from "./supabase";
import { PRODUCT_CARD_FIELDS } from "./types";
import type { CardProduct } from "./catalog";
import type { L10n } from "./i18n";

export interface RecipeItem {
  product: CardProduct;
  essential: boolean;
  note: L10n;
}
export interface Recipe {
  id: number;
  slug: string;
  title: L10n;
  intro: L10n;
  image_url: string | null;
  country: string | null;
  items: RecipeItem[];
}
export interface RecipeSuggestion extends Recipe {
  matched: number;
  /** Ingredients the shopper doesn't have yet (not in the given product ids). */
  missing: RecipeItem[];
}

const RECIPE_FIELDS = `id, slug, title, intro, image_url, country, sort, recipe_items(essential, note, products(${PRODUCT_CARD_FIELDS}, status))`;

type Row = {
  id: number; slug: string; title: L10n; intro: L10n; image_url: string | null; country: string | null; sort: number;
  recipe_items: { essential: boolean; note: L10n; products: (CardProduct & { status: string }) | null }[];
};

function shape(r: Row): Recipe {
  const items = (r.recipe_items ?? [])
    .filter((i) => i.products && i.products.status === "active" && i.products.stock > 0)
    .map((i) => {
      const { status: _s, ...product } = i.products!; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { product: product as CardProduct, essential: i.essential, note: i.note ?? {} };
    })
    .sort((a, b) => Number(b.essential) - Number(a.essential));
  return { id: r.id, slug: r.slug, title: r.title, intro: r.intro, image_url: r.image_url, country: r.country, items };
}

export async function getRecipes(): Promise<Recipe[]> {
  const { data } = await supabasePublic().from("recipes").select(RECIPE_FIELDS).eq("published", true).order("sort").order("id");
  return ((data ?? []) as unknown as Row[]).map(shape);
}

export async function getRecipe(slug: string): Promise<Recipe | null> {
  const { data } = await supabasePublic().from("recipes").select(RECIPE_FIELDS).eq("slug", slug).eq("published", true).maybeSingle();
  return data ? shape(data as unknown as Row) : null;
}

/** Recipes that use any of the given products, best match first, with what is still missing. */
export async function getRecipesForProducts(productIds: number[], limit = 3): Promise<RecipeSuggestion[]> {
  const ids = [...new Set(productIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
  if (!ids.length) return [];
  const sb = supabasePublic();
  const { data: links } = await sb.from("recipe_items").select("recipe_id").in("product_id", ids);
  const recipeIds = [...new Set((links ?? []).map((l) => l.recipe_id as number))];
  if (!recipeIds.length) return [];
  const { data } = await sb.from("recipes").select(RECIPE_FIELDS).in("id", recipeIds).eq("published", true);
  const have = new Set(ids);
  return ((data ?? []) as unknown as Row[])
    .map(shape)
    .map((r) => {
      const matched = r.items.filter((i) => have.has(i.product.id)).length;
      return { ...r, matched, missing: r.items.filter((i) => !have.has(i.product.id)) };
    })
    .filter((r) => r.matched > 0 && r.missing.length > 0)
    .sort((a, b) => b.matched - a.matched || b.missing.filter((m) => m.essential).length - a.missing.filter((m) => m.essential).length)
    .slice(0, limit);
}
