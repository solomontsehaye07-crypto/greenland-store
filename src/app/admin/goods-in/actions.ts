"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { bookDelivery, createProduct, type Delivery, type NewProduct } from "@/lib/products-admin";
import { applyRecommended, getPricingSettings } from "@/lib/pricing";

export type Found = { id: number; sku: string; title: string; image_url: string | null; stock: number; cost: number | null; price: number };

export async function quickCreate(p: NewProduct): Promise<{ product?: Found; error?: string }> {
  try {
    await assertStaff();
    if (!p.title_de?.trim()) return { error: "Enter the product name." };
    if (!(Number(p.price) > 0)) return { error: "Enter the selling price." };
    if (!p.category_id) return { error: "Choose a category." };
    const d = await createProduct({ ...p, price: Number(p.price), tax_rate: Number(p.tax_rate) || 7 });
    revalidateTag("catalog");
    return { product: { id: d.id, sku: d.sku, title: d.title_de || d.title, image_url: d.image_url, stock: d.stock, cost: d.cost_price, price: Number(p.price) } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the product." };
  }
}

export async function bookGoodsIn(input: { lines: Delivery[]; supplierId: number | null; note: string | null }): Promise<{ ok?: string; error?: string; stock?: Record<number, number> }> {
  try {
    const user = await assertStaff();
    const lines = input.lines.filter((l) => l.qty > 0);
    if (!lines.length) return { error: "Add at least one product with a quantity." };
    const done = await bookDelivery(lines, { userId: user.id, supplierId: input.supplierId, note: input.note || "Goods in" });
    if ((await getPricingSettings()).autoApply) await applyRecommended(done.map((d) => d.product_id), user.id, "auto (delivery)");
    const { data } = await supabaseAdmin().from("products").select("id, stock").in("id", done.map((d) => d.product_id));
    revalidateTag("catalog");
    revalidatePath("/admin/products");
    revalidatePath("/admin/finance");
    const units = done.reduce((s, d) => s + d.qty, 0);
    return { ok: `${units} items of ${done.length} products added to stock.`, stock: Object.fromEntries((data ?? []).map((r) => [r.id, r.stock])) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Booking failed." };
  }
}
