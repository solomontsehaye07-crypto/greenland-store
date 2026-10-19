import Link from "next/link";
import type { Metadata } from "next";
import { getCountryCounts } from "@/lib/catalog";
import { countryFlag, countryLabel } from "@/lib/countries";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Länder / Countries" };

export default async function CountriesPage() {
  const [list, lang] = await Promise.all([getCountryCounts(), getLang()]);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <h1 className="h-section">{lang === "de" ? "Nach Herkunft einkaufen" : "Shop by origin"}</h1>
      <p className="mt-1.5 text-sm text-muted">{lang === "de" ? "Produkte nach Land oder Küche." : "Products by country or cuisine."}</p>
      <ul className="mt-10 grid grid-cols-2 border-t border-line sm:grid-cols-3">
        {list.map((c) => (
          <li key={c.country} className="border-b border-line">
            <Link href={`/shop?country=${encodeURIComponent(c.country)}`} className="flex items-center gap-3 px-1 py-4 text-sm hover:bg-surface">
              <span className="text-xl" aria-hidden>{countryFlag(c.country)}</span>
              <span className="flex-1">{countryLabel(c.country, lang)}</span>
              <span className="pr-2 text-xs text-muted">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
