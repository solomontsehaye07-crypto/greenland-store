import { LoginForm } from "./login-form";

export const metadata = { title: "Anmeldung – Kanzlei-Zugang", robots: { index: false, follow: false } };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="stb grid min-h-screen place-items-center bg-sand px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-forest px-5 py-4 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/greenland-icon.svg" alt="" width={38} height={38} className="rounded-md bg-white p-0.5" />
          <div className="leading-tight">
            <h1 className="display text-lg font-bold">Kanzlei-Zugang</h1>
            <p className="text-[12.5px] text-white/75">Greenland Afro Asia Store, Kaiserslautern</p>
          </div>
        </div>
        <div className="p-5">
          {sp.denied && <p role="alert" className="mb-3 border border-[#e2b4b4] bg-[#fbeaea] px-3 py-2 text-sm text-[#8a1f1f]">Dieses Konto hat keinen Zugang zum Portal.</p>}
          <LoginForm />
          <p className="mt-4 text-xs leading-relaxed text-[#666]">Zugang nur für die vom Shop freigeschaltete Steuerkanzlei. Sie sehen ausschließlich das Kassenbuch und das Online-Buch, keine weiteren Shopdaten.</p>
        </div>
      </div>
    </main>
  );
}
