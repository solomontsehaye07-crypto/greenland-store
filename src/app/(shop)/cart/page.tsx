import { getLang } from "@/lib/i18n";
import { getFrozenInfo } from "@/lib/commerce";
import { CartView } from "./cart-view";

export const metadata = { title: "Warenkorb / Cart" };

export default async function CartPage() {
  const [lang, frozen] = await Promise.all([getLang(), getFrozenInfo()]);
  return <CartView lang={lang} frozen={frozen} />;
}
