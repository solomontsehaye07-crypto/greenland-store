"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";

const ROLES = ["staff", "manager", "admin", "customer"];
const back = (msg: string): never => redirect(`/admin/team?msg=${encodeURIComponent(msg)}`);

/** Invites someone by email (they get a link to set a password) and gives them a role. Owner only. */
export async function inviteMember(fd: FormData) {
  const me = await assertStaff(["admin"]);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role") ?? "staff");
  const name = String(fd.get("name") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("Please enter a valid email address.");
  if (!["staff", "manager", "admin"].includes(role)) back("Choose a role.");
  const sb = supabaseAdmin();
  let userId: string | null = null;
  const { data: inv, error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl()}/admin/auth/confirm`, data: { full_name: name } });
  if (inv?.user) userId = inv.user.id;
  if (error) {
    // already has an account: find it and just change the role
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (!userId) back(`Could not invite: ${error.message}`);
  }
  if (userId === me.id) back("You can't change your own role here.");
  await sb.from("profiles").upsert({ id: userId!, role, email, ...(name ? { full_name: name } : {}) }, { onConflict: "id" });
  revalidatePath("/admin/team");
  back(inv?.user ? `Invitation sent to ${email}.` : `${email} now has the role ${role}.`);
}

export async function setRole(fd: FormData) {
  const me = await assertStaff(["admin"]);
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  if (id === me.id) back("You can't change your own role.");
  if (!ROLES.includes(role)) back("Unknown role.");
  await supabaseAdmin().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/team");
  back(role === "customer" ? "Access removed." : "Role changed.");
}

/** Mobile number for signing in with an SMS code. */
export async function setPhone(fd: FormData) {
  await assertStaff(["admin"]);
  const id = String(fd.get("id"));
  const raw = String(fd.get("phone") ?? "").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  const phone = !digits ? "" : digits.startsWith("+") ? digits : digits.startsWith("00") ? `+${digits.slice(2)}` : digits.startsWith("0") ? `+49${digits.slice(1)}` : `+${digits}`;
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, phone ? { phone, phone_confirm: true } : { phone: "" });
  if (error) back(`Could not save the number: ${error.message}`);
  revalidatePath("/admin/team");
  back(phone ? `Mobile number saved: ${phone}. This person can now sign in with an SMS code.` : "Mobile number removed.");
}
