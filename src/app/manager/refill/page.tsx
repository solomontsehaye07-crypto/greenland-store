import { redirect } from "next/navigation";
import { MANAGER_ROLES, requireStaff } from "@/lib/auth";

/** Supplier orders moved under Orders. */
export default async function OldRefill({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireStaff(MANAGER_ROLES, "/manager"); // every page checks itself, not only the layout
  const sp = new URLSearchParams(await searchParams);
  redirect(`/manager/orders/suppliers${sp.toString() ? `?${sp}` : ""}`);
}
