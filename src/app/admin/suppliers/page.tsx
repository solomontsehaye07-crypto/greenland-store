import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { assignSupplierToCategory } from "../actions";

export default async function Suppliers() {
  await requireStaff();
  const sb = supabaseAdmin();
  const [{ data: sups }, { data: cats }, { data: counts }] = await Promise.all([
    sb.from("suppliers").select("*").order("name"),
    sb.from("categories").select("id, title, parent_id").order("sort"),
    sb.from("products").select("supplier_id").not("supplier_id", "is", null),
  ]);
  const n = new Map<number, number>();
  (counts ?? []).forEach((c) => n.set(c.supplier_id, (n.get(c.supplier_id) ?? 0) + 1));
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Suppliers</h1>
        <Link href="/admin/suppliers/new" className="btn btn-primary">Add supplier</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="table">
          <thead><tr><th>Name</th><th>Contact</th><th>Sends via</th><th>Lead time</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {(sups ?? []).map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}{s.is_dropshipper ? <span className="ml-2 rounded-full bg-gold/40 px-2 py-0.5 text-xs">dropship</span> : null}</td>
                <td className="text-sm">{s.contact_name}<div className="text-xs text-muted">{s.email} {s.whatsapp ?? s.phone}</div></td>
                <td>{s.preferred_channel}</td>
                <td>{s.lead_time_days} days</td>
                <td>{n.get(s.id) ?? 0}</td>
                <td><Link href={`/admin/suppliers/${s.id}`} className="text-green underline">Edit</Link></td>
              </tr>
            ))}
            {!sups?.length && <tr><td colSpan={6} className="py-8 text-center text-muted">No suppliers yet. Add one to start sending refill orders.</td></tr>}
          </tbody>
        </table>
      </div>
      {!!sups?.length && (
        <form action={assignSupplierToCategory} className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5">
          <div><label className="label">Assign supplier</label><select name="supplier_id" className="input">{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="label">to every product in</label><select name="category_id" className="input">{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.title}</option>)}</select></div>
          <button className="btn btn-ghost">Assign</button>
        </form>
      )}
    </div>
  );
}
