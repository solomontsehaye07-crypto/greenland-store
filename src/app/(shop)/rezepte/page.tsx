import Link from "next/link";
import { getRecipes } from "@/lib/recipes";
import { getLang, tx } from "@/lib/i18n";
import { countryLabel } from "@/lib/countries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rezepte / Recipes" };

export default async function RecipesPage() {
  const [recipes, lang] = await Promise.all([getRecipes(), getLang()]);
  const de = lang === "de";
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{de ? "Rezeptideen" : "Recipe ideas"}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        {de ? "Klassiker aus Westafrika und Äthiopien – mit allen Zutaten aus unserem Sortiment, direkt in den Warenkorb." : "Classics from West Africa and Ethiopia, with every ingredient from our shelves, straight to your cart."}
      </p>
      <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <li key={r.slug}>
            <Link href={`/rezepte/${r.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                )}
              </div>
              <div className="mt-4 text-xs text-muted">{countryLabel(r.country, lang)} · {r.items.length} {de ? "Zutaten" : "ingredients"}</div>
              <h2 className="mt-1 text-lg font-semibold">{tx(r.title, lang)}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{tx(r.intro, lang)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
