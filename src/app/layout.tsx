import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { CartProvider } from "@/components/cart";
import { getSite, themeCss } from "@/lib/content";
import { getLang, tx } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const [{ site }, lang] = await Promise.all([getSite(), getLang()]);
  const name = site.name || "Greenland Afro Asia Store";
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: tx(site.seoTitle, lang) || name, template: `%s · ${name}` },
    description: tx(site.seoDescription, lang) || undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ theme }, lang] = await Promise.all([getSite(), getLang()]);
  return (
    <html lang={lang}>
      <head>
        <style>{themeCss(theme)}</style>
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
