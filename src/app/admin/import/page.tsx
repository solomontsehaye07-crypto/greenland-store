import { requireStaff } from "@/lib/auth";
import { Importer } from "./importer";

export default async function ImportPage() {
  await requireStaff();
  return (
    <div>
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Batch import</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Upload a CSV or Excel sheet for stock counts, deliveries (with best-before dates), price lists or new products. You always see a preview
        before anything is saved. Download a template:{" "}
        <a className="text-green underline" href="/templates/stock-import.csv">stock</a>,{" "}
        <a className="text-green underline" href="/templates/product-import.csv">products</a>,{" "}
        <a className="text-green underline" href="/templates/supplier-prices.csv">supplier prices</a>.
      </p>
      <div className="mt-8">
        <Importer />
      </div>
    </div>
  );
}
