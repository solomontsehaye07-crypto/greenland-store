import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHead } from "@/components/admin/ui";
import { GoodsIn } from "./goods-in";

export const dynamic = "force-dynamic";

export default async function GoodsInPage({ searchParams }: { searchParams: Promise<{ supplier?: string; product?: string }> }) {
  await requireStaff();
  const { supplier, product } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data: sups }, { data: cats }, { data: pre }] = await Promise.all([
    sb.from("suppliers").select("id, name").eq("active", true).order("name"),
    sb.from("categories").select("id, title, title_de, parent_id").order("sort"),
    product ? sb.from("products").select("id, sku, title, title_de, image_url, stock, cost_price, price").eq("id", Number(product)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const parents = (cats ?? []).filter((c) => !c.parent_id);
  const catOptions = parents.flatMap((p) => (cats ?? []).filter((c) => c.parent_id === p.id).map((c) => ({ id: c.id, label: `${p.title_de || p.title} › ${c.title_de || c.title}` })));
  return (
    <div>
      <PageHead
        title="Goods in"
        text="Book a delivery by hand: find each product (or scan its barcode), enter how many arrived and what they cost. The quantities are added to the existing stock. Products you don’t have yet can be created right here."
      />
      <GoodsIn
        suppliers={sups ?? []}
        categories={catOptions}
        initialSupplier={supplier ? Number(supplier) : null}
        initialProduct={pre ? { id: pre.id, sku: pre.sku, title: pre.title_de || pre.title, image_url: pre.image_url, stock: pre.stock, cost: pre.cost_price, price: Number(pre.price) } : null}
      />
    </div>
  );
}
