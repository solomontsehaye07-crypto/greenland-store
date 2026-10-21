import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata = { title: "Subscribers" };

export default async function Subscribers() {
  await requireStaff();
  const { data, count } = await supabaseAdmin().from("subscribers").select("email, lang, source, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1000);
  const rows = data ?? [];
  const csv = "email,language,signed_up\n" + rows.map((r) => [r.email, r.lang, r.created_at.slice(0, 10)].map((v) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`).join(",")).join("\n");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Newsletter subscribers</h1>
          <p className="mt-1 text-sm text-muted">{count ?? 0} people signed up through the newsletter box on your website.</p>
        </div>
        {rows.length > 0 && (
          <a download="subscribers.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} className="btn btn-primary">Download as CSV</a>
        )}
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Email</th><th>Language</th><th>Signed up</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email}><td>{r.email}</td><td className="uppercase">{r.lang}</td><td>{new Date(r.created_at).toLocaleDateString("de-DE")}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Nobody has signed up yet. Add or edit the newsletter section under Website to start collecting emails.</p>
        )}
      </section>
    </div>
  );
}
