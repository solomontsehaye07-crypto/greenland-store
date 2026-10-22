import { getLang } from "@/lib/i18n";
import { getFrozenInfo } from "@/lib/commerce";
import { CartView } from "./cart-view";
import { getCartPerks } from "@/lib/perks";

export const metadata = { title: "Warenkorb / Cart" };

export default async function CartPage() {
  const [lang, frozen, perks] = await Promise.all([getLang(), getFrozenInfo(), getCartPerks()]);
  return <CartView lang={lang} frozen={frozen} perks={perks} />;
}
