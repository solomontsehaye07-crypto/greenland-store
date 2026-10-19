import type { Metadata } from "next";
import { ProductBrowser, type BrowseParams } from "@/components/product-browser";
import { countryLabel } from "@/lib/countries";
import { getLang, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const [params, lang] = await Promise.all([searchParams, getLang()]);
  const title = params.country ? countryLabel(params.country, lang, true) : params.sale === "1" ? ui("offers", lang) : ui("shopAll", lang);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10">
      <h1 className="h-section mb-8">{title}</h1>
      <ProductBrowser basePath="/shop" params={params} lang={lang} />
    </div>
  );
}
