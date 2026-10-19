import { getRecipesForProducts } from "@/lib/recipes";
import { RecipeList } from "./recipe-suggestions";

/** Recipe ideas for a product page: dishes this product is used in, with the other ingredients. */
export async function ProductRecipes({ productId, lang, compact }: { productId: number; lang: "de" | "en"; compact?: boolean }) {
  const recipes = await getRecipesForProducts([productId]);
  if (!recipes.length) return null;
  return <RecipeList recipes={recipes} lang={lang} compact={compact} />;
}
