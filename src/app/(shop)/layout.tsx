import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Icon } from "@/components/icons";
import { getSite } from "@/lib/content";
import { getLang, ui } from "@/lib/i18n";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [{ site }, lang] = await Promise.all([getSite(), getLang()]);
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {site.showWhatsappButton !== false && site.whatsapp && (
        <a
          href={`https://wa.me/${site.whatsapp}`}
          rel="noopener"
          aria-label={ui("writeUs", lang)}
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
        >
          <Icon name="whatsapp" size={28} />
        </a>
      )}
    </>
  );
}
