import { supabaseServer } from "@/lib/supabase";
import { AdminNav } from "@/components/admin/nav";
import { signOut } from "./actions";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return <div className="min-h-screen bg-paper">{children}</div>;
  return (
    <div className="admin min-h-screen bg-paper lg:flex">
      <AdminNav
        email={user.email ?? ""}
        signOut={
          <form action={signOut}>
            <button className="font-medium text-muted hover:text-ink hover:underline">Sign out</button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
