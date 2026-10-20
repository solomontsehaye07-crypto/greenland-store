import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Icon } from "@/components/icons";
import { CartDrawer } from "@/components/cart-drawer";
import { HeaderScroll, RevealOnScroll } from "@/components/reveal";
import { getSite } from "@/lib/content";
import { getLang, ui } from "@/lib/i18n";
import { getFrozenInfo } from "@/lib/commerce";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [{ site }, lang, frozen] = await Promise.all([getSite(), getLang(), getFrozenInfo()]);
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <CartDrawer lang={lang} frozen={frozen} />
      <RevealOnScroll />
      <HeaderScroll />
      {site.showWhatsappButton !== false && site.whatsapp && (
        <a
          href={`https://wa.me/${site.whatsapp}`}
          rel="noopener"
          aria-label={ui("writeUs", lang)}
          className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-md transition-transform hover:scale-105"
        >
          <Icon name="whatsapp" size={24} />
        </a>
      )}
    </>
  );
}
