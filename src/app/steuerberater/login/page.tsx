import { LoginForm } from "./login-form";

export const metadata = { title: "Anmeldung – Steuerberater-Portal", robots: { index: false, follow: false } };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="stb grid min-h-screen place-items-center border-t-[3px] border-[#c0222b] bg-[#e9e9e9] px-4">
      <div className="w-full max-w-sm border border-[#b9b9b9] bg-white shadow-sm">
        <div className="border-b border-[#c3c3c3] px-5 py-3">
          <h1 className="stb-brand text-[20px] leading-tight"><span className="font-bold">Greenland:</span> Steuerberater-Portal</h1>
          <p className="mt-0.5 text-[#666]">Greenland Afro Asia Store, Kaiserslautern</p>
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
