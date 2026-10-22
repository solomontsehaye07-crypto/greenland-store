import "server-only";
import { supabaseAdmin } from "./supabase";
import { DEFAULT_TIERS, sanitizeTiers, type TierConfig } from "./tiers";

// Cart rewards shown in the cart drawer, the cart page and at checkout:
//  - free delivery from the lowest "free from" value of the active delivery options (not pickup)
//  - one free gift product once the cart reaches a threshold (settings key public.gift)
//  - quantity discounts per line (settings key public.qty_tiers, see lib/tiers.ts)
// Thresholds are judged on the value of the goods after discounts, like the server does.
// The gift is never part of the customer's cart; createOrder adds it on the server.

export type GiftSetting = { enabled: boolean; product_id: number | null; threshold: number };
export type GiftProduct = { id: number; title: string; title_de: string | null; slug: string; image_url: string | null; value: number };
export type CartPerks = { freeFrom: number | null; gift: (GiftProduct & { threshold: number }) | null; tiers: TierConfig };

export async function getQtyTiers(): Promise<TierConfig> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.qty_tiers").maybeSingle();
  return data ? sanitizeTiers(data.value) : DEFAULT_TIERS;
}

export const DEFAULT_GIFT: GiftSetting = { enabled: false, product_id: null, threshold: 80 };

export async function getGiftSetting(): Promise<GiftSetting> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "public.gift").maybeSingle();
  return { ...DEFAULT_GIFT, ...((data?.value ?? {}) as Partial<GiftSetting>) };
}

/** The gift product, if the gift is switched on and the product can still be handed out. */
export async function activeGift(): Promise<(GiftProduct & { threshold: number; sku: string | null; tax_rate: number; is_dropship: boolean }) | null> {
  const g = await getGiftSetting();
  if (!g.enabled || !g.product_id || !(g.threshold > 0)) return null;
  const { data: p } = await supabaseAdmin()
    .from("products")
    .select("id, sku, title, title_de, slug, image_url, price, stock, status, is_dropship, tax_rate")
    .eq("id", g.product_id)
    .maybeSingle();
  if (!p || p.status !== "active" || (!p.is_dropship && Number(p.stock) < 1)) return null;
  return {
    id: p.id,
    sku: p.sku,
    title: p.title,
    title_de: p.title_de,
    slug: p.slug,
    image_url: p.image_url,
    value: Number(p.price),
    threshold: Number(g.threshold),
    tax_rate: Number(p.tax_rate ?? 7),
    is_dropship: !!p.is_dropship,
  };
}

export async function getCartPerks(): Promise<CartPerks> {
  const [{ data: ship }, gift, tiers] = await Promise.all([
    supabaseAdmin().from("shipping_methods").select("free_from, type").eq("active", true).not("free_from", "is", null),
    activeGift(),
    getQtyTiers(),
  ]);
  const values = (ship ?? []).filter((m) => m.type !== "pickup").map((m) => Number(m.free_from)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    freeFrom: values.length ? Math.min(...values) : null,
    gift: gift ? { id: gift.id, title: gift.title, title_de: gift.title_de, slug: gift.slug, image_url: gift.image_url, value: gift.value, threshold: gift.threshold } : null,
    tiers,
  };
}
