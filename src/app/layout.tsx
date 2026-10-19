import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { CartProvider } from "@/components/cart";


export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Greenland Afro Asia Store – African & Asian groceries in Kaiserslautern", template: "%s · Greenland Afro Asia Store" },
  description:
    "Authentic African, Asian and Latin American groceries, hair & skin care and home décor. Delivery across Germany, local delivery and pickup in Kaiserslautern.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
