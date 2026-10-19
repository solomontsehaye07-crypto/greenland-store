import { getLang } from "@/lib/i18n";
import { CartView } from "./cart-view";

export const metadata = { title: "Warenkorb / Cart" };

export default async function CartPage() {
  return <CartView lang={await getLang()} />;
}
