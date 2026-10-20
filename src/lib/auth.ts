import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase";

export type Role = "staff" | "manager" | "admin";
export const STAFF_ROLES: Role[] = ["staff", "manager", "admin"];
/** Areas only the owner (admin) and managers may open. */
export const MANAGER_ROLES: Role[] = ["manager", "admin"];

/** Returns the signed-in staff user or redirects to the admin login. */
export async function requireStaff(roles: Role[] = STAFF_ROLES) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect("/admin/login?denied=1");
  if (!roles.includes(profile.role)) redirect("/admin?denied=1");
  return { user, profile: profile as { role: Role; full_name: string | null } };
}

/** Same check for server actions / route handlers – throws instead of redirecting. */
export async function assertStaff(roles: Role[] = STAFF_ROLES) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) throw new Error("Staff only");
  if (!roles.includes(profile.role)) throw new Error("Only the owner or a manager can do this");
  return user;
}

/** The signed-in user's staff role, or null. */
export async function currentRole(): Promise<Role | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return data && STAFF_ROLES.includes(data.role) ? (data.role as Role) : null;
}
