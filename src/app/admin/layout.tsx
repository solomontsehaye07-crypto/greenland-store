import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import { signOut } from "./actions";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products & stock"],
  ["/admin/purchase-orders", "Refill orders"],
  ["/admin/suppliers", "Suppliers"],
  ["/admin/import", "Batch import"],
  ["/admin/settings", "Settings"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return <div className="min-h-screen bg-paper">{children}</div>;
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-white px-4 py-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link href="/admin" className="display block text-xl font-extrabold text-green">
          Greenland admin
        </Link>
        <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 hidden text-xs text-muted lg:block">
          {user.email}
          <form action={signOut}>
            <button className="mt-2 text-green underline">Sign out</button>
          </form>
          <Link href="/" className="mt-2 block text-green underline">View shop</Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
