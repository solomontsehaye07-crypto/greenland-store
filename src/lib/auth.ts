import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase";

/** Returns the signed-in staff user or redirects to the admin login. */
export async function requireStaff() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !["staff", "admin"].includes(profile.role)) redirect("/admin/login?denied=1");
  return { user, profile };
}

/** Same check for server actions / route handlers – throws instead of redirecting. */
export async function assertStaff() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["staff", "admin"].includes(profile.role)) throw new Error("Staff only");
  return user;
}
