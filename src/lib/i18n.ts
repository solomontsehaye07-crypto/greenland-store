import { cookies } from "next/headers";

export type Lang = "de" | "en";
export const LANGS: Lang[] = ["de", "en"];

/** A text that exists in both languages. Either side may be empty; the other is used as fallback. */
export type L10n = { de?: string; en?: string };

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "en" ? "en" : "de";
}

export function tx(v: L10n | string | null | undefined, lang: Lang): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return (lang === "en" ? v.en || v.de : v.de || v.en) ?? "";
}

/** Fixed interface words. Everything a shop owner would want to change lives in the website editor instead. */
const UI = {
  search: { de: "Suchen", en: "Search" },
  searchPlaceholder: { de: "Gari, Palmöl, Sheabutter suchen …", en: "Search gari, palm oil, shea butter…" },
  cart: { de: "Warenkorb", en: "Cart" },
  addToCart: { de: "In den Warenkorb", en: "Add to cart" },
  add: { de: "Hinzufügen", en: "Add" },
  added: { de: "Hinzugefügt", en: "Added" },
  outOfStock: { de: "Ausverkauft", en: "Out of stock" },
  frozen: { de: "Tiefkühl", en: "Frozen" },
  noPhoto: { de: "Noch kein Foto", en: "No photo yet" },
  seeAll: { de: "Alle ansehen", en: "See all" },
  allProducts: { de: "Alle Produkte", en: "All products" },
  products: { de: "Produkte", en: "products" },
  deliveryPickup: { de: "Lieferung & Abholung", en: "Delivery & pickup" },
  shop: { de: "Shop", en: "Shop" },
  help: { de: "Hilfe", en: "Help" },
  legal: { de: "Rechtliches", en: "Legal" },
  vatNote: { de: "Alle Preise inkl. MwSt., zzgl. Versand.", en: "All prices include VAT, plus shipping." },
  sortBy: { de: "Sortieren", en: "Sort" },
  sortFeatured: { de: "Empfohlen", en: "Featured" },
  sortPriceAsc: { de: "Preis aufsteigend", en: "Price: low to high" },
  sortPriceDesc: { de: "Preis absteigend", en: "Price: high to low" },
  sortName: { de: "Name A–Z", en: "Name A–Z" },
  results: { de: "Ergebnisse", en: "results" },
  noResults: { de: "Nichts gefunden. Versuche ein anderes Wort oder stöbere in den Kategorien.", en: "Nothing found. Try another word or browse the categories." },
  subscribe: { de: "Anmelden", en: "Sign up" },
  emailAddress: { de: "E-Mail-Adresse", en: "Email address" },
  thanksSubscribed: { de: "Danke! Du bist dabei.", en: "Thanks, you're on the list." },
  writeUs: { de: "Schreib uns auf WhatsApp", en: "Message us on WhatsApp" },
  prev: { de: "Zurück", en: "Previous" },
  next: { de: "Weiter", en: "Next" },
  home: { de: "Start", en: "Home" },
  page: { de: "Seite", en: "Page" },
  of: { de: "von", en: "of" },
  perKg: { de: "pro kg", en: "per kg" },
  inStock: { de: "Auf Lager", en: "In stock" },
  description: { de: "Beschreibung", en: "Description" },
  details: { de: "Details", en: "Details" },
  language: { de: "Sprache", en: "Language" },
  menu: { de: "Menü", en: "Menu" },
  close: { de: "Schließen", en: "Close" },
  shopAll: { de: "Alle Produkte", en: "Shop all" },
  countries: { de: "Länder", en: "Countries" },
  recipes: { de: "Rezepte", en: "Recipes" },
  offers: { de: "Angebote", en: "Offers" },
  filter: { de: "Filter", en: "Filter" },
  category: { de: "Kategorie", en: "Category" },
  country: { de: "Herkunft", en: "Origin" },
  allCountries: { de: "Alle Länder", en: "All countries" },
  allCategories: { de: "Alle Kategorien", en: "All categories" },
  onlyInStock: { de: "Nur verfügbare", en: "In stock only" },
  sortNew: { de: "Neueste", en: "Newest" },
  reset: { de: "Zurücksetzen", en: "Reset" },
  bestseller: { de: "Beliebt", en: "Popular" },
  youMayLike: { de: "Das könnte dir auch gefallen", en: "You may also like" },
  favourites: { de: "Kundenlieblinge", en: "Customer favourites" },
} satisfies Record<string, Required<L10n>>;

export type UIKey = keyof typeof UI;
export function ui(key: UIKey, lang: Lang) {
  return UI[key][lang];
}
