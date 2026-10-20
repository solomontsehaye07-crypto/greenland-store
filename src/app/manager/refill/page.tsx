import { redirect } from "next/navigation";

/** Supplier orders moved under Orders. */
export default async function OldRefill({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = new URLSearchParams(await searchParams);
  redirect(`/manager/orders/suppliers${sp.toString() ? `?${sp}` : ""}`);
}
