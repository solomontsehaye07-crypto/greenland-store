import { LoginForm } from "./login-form";

export const metadata = { title: "Anmeldung – Steuerberater-Portal", robots: { index: false, follow: false } };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="stb grid min-h-screen place-items-center bg-[#ececec] px-4">
      <div className="w-full max-w-sm border border-[#b9b9b9] bg-white shadow-sm">
        <div className="border-b-2 border-[#b4232a] px-5 py-3">
          <p className="text-[0.8125rem] font-bold text-[#b4232a]">Greenland Afro Asia Store</p>
          <h1 className="text-lg font-semibold text-[#333]">Steuerberater-Portal</h1>
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
