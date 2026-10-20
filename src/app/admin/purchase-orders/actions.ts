"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export type PoLine = { id?: number; product_id: number; qty: number; unit_cost: number | null; note: string | null };
export type PoDraft = { expected_at: string | null; notes: string | null; message: string | null; show_prices: boolean; items: PoLine[] };

/** Saves the whole refill request from the editor (autosave). */
export async function savePo(id: number, draft: PoDraft): Promise<{ ok?: boolean; error?: string; items?: PoLine[] }> {
  try {
    await assertStaff();
    const sb = supabaseAdmin();
    const { data: po } = await sb.from("purchase_orders").select("status").eq("id", id).single();
    if (!po) return { error: "Refill request not found." };
    if (["received", "cancelled"].includes(po.status)) return { error: "This request is closed and can't be changed." };
    const exp = draft.expected_at && /^\d{4}-\d{2}-\d{2}$/.test(draft.expected_at) ? draft.expected_at : null;
    await sb
      .from("purchase_orders")
      .update({
        expected_at: exp,
        notes: draft.notes?.slice(0, 1000) || null,
        message: draft.message?.slice(0, 1500) || null,
        show_prices: !!draft.show_prices,
        updated_at: new Date().toISOString(),
        ...(po.status !== "draft" ? { edited_after_send: true } : {}),
      })
      .eq("id", id);

    const { data: existing } = await sb.from("purchase_order_items").select("id, qty_received").eq("purchase_order_id", id);
    const keep = new Set(draft.items.filter((l) => l.id).map((l) => l.id));
    const remove = (existing ?? []).filter((e) => !keep.has(e.id) && !e.qty_received).map((e) => e.id);
    if (remove.length) await sb.from("purchase_order_items").delete().in("id", remove);
    for (const l of draft.items) {
      const row = { qty: Math.max(1, Math.round(Number(l.qty) || 1)), unit_cost: l.unit_cost == null || Number.isNaN(Number(l.unit_cost)) ? null : Number(l.unit_cost), note: l.note?.slice(0, 200) || null };
      if (l.id) await sb.from("purchase_order_items").update(row).eq("id", l.id).eq("purchase_order_id", id);
      else await sb.from("purchase_order_items").insert({ ...row, purchase_order_id: id, product_id: l.product_id });
    }
    const { data: items } = await sb.from("purchase_order_items").select("id, product_id, qty, unit_cost, note").eq("purchase_order_id", id).order("id");
    return { ok: true, items: (items ?? []) as PoLine[] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Saving failed." };
  }
}

/** Starts a new refill request for a supplier. */
export async function newRefillRequest(fd: FormData) {
  const user = await assertStaff();
  const supplierId = Number(fd.get("supplier_id"));
  if (!supplierId) redirect("/admin/purchase-orders?msg=Choose a supplier first.");
  const sb = supabaseAdmin();
  const { data: sup } = await sb.from("suppliers").select("lead_time_days").eq("id", supplierId).single();
  const expected = new Date(Date.now() + (sup?.lead_time_days ?? 3) * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("purchase_orders").insert({ supplier_id: supplierId, status: "draft", kind: "refill", expected_at: expected, created_by: user.id }).select("id").single();
  revalidatePath("/admin/purchase-orders");
  redirect(`/admin/purchase-orders/${data!.id}`);
}

export async function deleteDraftPo(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("po_id"));
  const sb = supabaseAdmin();
  const { data: po } = await sb.from("purchase_orders").select("status").eq("id", id).single();
  if (po?.status === "draft") await sb.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/admin/purchase-orders");
  redirect("/admin/purchase-orders?msg=Draft cancelled.");
}
