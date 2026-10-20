import { requireStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, Notice, PageHead } from "@/components/admin/ui";
import { inviteMember, setRole } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_TEXT: Record<string, string> = {
  admin: "Owner – everything, including team and payments",
  manager: "Manager – everything except the team; can use the Manager app",
  staff: "Staff – orders, products, goods in, refill requests, website; no money pages",
};

export default async function Team({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { user } = await requireStaff(["admin"]);
  const { msg } = await searchParams;
  const sb = supabaseAdmin();
  const [{ data: profiles }, { data: users }] = await Promise.all([
    sb.from("profiles").select("id, full_name, role, email").in("role", ["staff", "manager", "admin"]),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emailOf = (id: string) => users?.users.find((u) => u.id === id)?.email ?? "";
  const lastSeen = (id: string) => users?.users.find((u) => u.id === id)?.last_sign_in_at;
  return (
    <div>
      <PageHead title="Team & roles" text="Who can open the admin and what they may do. Each person signs in with their own email." />
      <Notice msg={msg} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="People with access">
          <ul className="divide-y divide-line">
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" data-no-translate>{p.full_name || p.email || emailOf(p.id)}</p>
                  <p className="truncate text-xs text-muted" data-no-translate>{p.email || emailOf(p.id)}{lastSeen(p.id) ? ` · ${new Date(lastSeen(p.id)!).toLocaleDateString("de-DE")}` : ""}</p>
                </div>
                {p.id === user.id ? (
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">You · Owner</span>
                ) : (
                  <form action={setRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role} className="input h-9 w-auto py-1 text-sm">
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Owner</option>
                      <option value="customer">No access</option>
                    </select>
                    <button className="btn btn-ghost h-9 py-1 text-sm">Save</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card title="Invite someone" text="They receive an email to set their password.">
            <form action={inviteMember} className="space-y-3">
              <div><label className="label" htmlFor="t-name">Name</label><input id="t-name" name="name" className="input" /></div>
              <div><label className="label" htmlFor="t-email">Email</label><input id="t-email" name="email" type="email" required className="input" /></div>
              <div>
                <label className="label" htmlFor="t-role">Role</label>
                <select id="t-role" name="role" defaultValue="staff" className="input"><option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Owner</option></select>
              </div>
              <button className="btn btn-primary w-full">Send invitation</button>
            </form>
          </Card>
          <Card title="Roles">
            <ul className="space-y-2 text-sm">{Object.entries(ROLE_TEXT).map(([k, v]) => <li key={k}>{v}</li>)}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
