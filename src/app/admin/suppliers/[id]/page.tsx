import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { saveSupplier } from "../../actions";
import type { Supplier } from "@/lib/types";

export default async function SupplierEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  let s: Partial<Supplier> = { preferred_channel: "email", lead_time_days: 3, min_order_value: 0 };
  if (id !== "new") {
    const { data } = await supabaseAdmin().from("suppliers").select("*").eq("id", Number(id)).single();
    if (data) s = data;
  }
  return (
    <div className="max-w-2xl">
      <Link href="/admin/suppliers" className="text-sm text-green">← Suppliers</Link>
      <h1 className="display mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{s.id ? s.name : "New supplier"}</h1>
      <form action={saveSupplier} className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        {s.id && <input type="hidden" name="id" value={s.id} />}
        <div className="sm:col-span-2"><label className="label">Company name *</label><input name="name" required defaultValue={s.name} className="input" /></div>
        <div><label className="label">Contact person</label><input name="contact_name" defaultValue={s.contact_name ?? ""} className="input" /></div>
        <div><label className="label">Email (for PDF orders)</label><input name="email" type="email" defaultValue={s.email ?? ""} className="input" /></div>
        <div><label className="label">Phone</label><input name="phone" defaultValue={s.phone ?? ""} className="input" /></div>
        <div><label className="label">WhatsApp number</label><input name="whatsapp" placeholder="+49 151 …" defaultValue={s.whatsapp ?? ""} className="input" /></div>
        <div>
          <label className="label">Send refill orders by</label>
          <select name="preferred_channel" defaultValue={s.preferred_channel} className="input"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option></select>
        </div>
        <div><label className="label">Lead time (days)</label><input name="lead_time_days" type="number" defaultValue={s.lead_time_days} className="input" /></div>
        <div><label className="label">Minimum order (€)</label><input name="min_order_value" type="number" step="0.01" defaultValue={s.min_order_value} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><input name="address" defaultValue={s.address ?? ""} className="input" /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="is_dropshipper" defaultChecked={s.is_dropshipper} className="accent-[var(--green)]" />
          This supplier ships orders directly to my customers (dropshipping)
        </label>
        <div className="sm:col-span-2"><label className="label">Notes</label><textarea name="notes" rows={3} defaultValue={s.notes ?? ""} className="input" /></div>
        <button className="btn btn-primary sm:col-span-2">Save supplier</button>
      </form>
    </div>
  );
}
