import { supabasePublic } from "./supabase";
import { DEFAULT_THEME, type SiteSettings, type Theme } from "./sections";
import type { L10n } from "./i18n";
import { currentDesign, onColor, storeFrom, type Design } from "./designs";

export interface HomeSection {
  id: number;
  position: number;
  type: string;
  enabled: boolean;
  data: Record<string, unknown>;
}

export interface CmsPage {
  slug: string;
  title: L10n;
  body: L10n;
  published: boolean;
  show_in_footer: boolean;
  sort: number;
  image?: string | null;
}

export async function getSite(): Promise<{ site: SiteSettings; theme: Theme; store: Record<string, string>; design: Design }> {
  const { data } = await supabasePublic().from("settings").select("key, value").in("key", ["public.site", "public.theme", "public.store", "public.designs", "public.shop"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value ?? {};
  const legacy = get("public.theme") as Partial<Theme>;
  const { design } = currentDesign(storeFrom(get("public.designs"), legacy));
  const site = { ...(get("public.site") as SiteSettings) };
  if (design.announcement && (design.announcement.de || design.announcement.en))
    site.announcements = [{ text: design.announcement }, ...(site.announcements ?? [])];
  const shop = get("public.shop") as { paused?: boolean; message?: L10n };
  if (shop.paused)
    site.announcements = [{ text: shop.message && (shop.message.de || shop.message.en) ? shop.message : { de: "Der Onlineshop pausiert gerade – Bestellungen sind bald wieder möglich.", en: "The online shop is paused – orders will be possible again soon." } }];
  return {
    site,
    theme: { ...DEFAULT_THEME, ...legacy, paper: design.paper, sand: design.sand, ink: design.ink, terra: design.terra, saffron: design.saffron, forest: design.forest, indigo: design.indigo },
    store: get("public.store") as Record<string, string>,
    design,
  };
}

export async function getHomeSections(): Promise<HomeSection[]> {
  const { data } = await supabasePublic().from("home_sections").select("*").eq("enabled", true).order("position").order("id");
  return (data ?? []) as HomeSection[];
}

export async function getFooterPages(): Promise<CmsPage[]> {
  const { data } = await supabasePublic().from("pages").select("slug, title, show_in_footer, sort, published").eq("published", true).eq("show_in_footer", true).order("sort");
  return (data ?? []) as CmsPage[];
}

export async function getPage(slug: string): Promise<CmsPage | null> {
  const { data } = await supabasePublic().from("pages").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  return (data as CmsPage) ?? null;
}

/** CSS custom properties for the chosen theme and the current design's hero. */
export function themeCss(t: Theme, d?: Design) {
  const safe = (v: string, def: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v ?? "") ? v : def);
  const D = DEFAULT_THEME;
  let css = `:root{--paper:${safe(t.paper, D.paper)};--sand:${safe(t.sand, D.sand)};--ink:${safe(t.ink, D.ink)};--terra:${safe(t.terra, D.terra)};--saffron:${safe(t.saffron, D.saffron)};--forest:${safe(t.forest, D.forest)};--indigo:${safe(t.indigo, D.indigo)};`;
  if (d) {
    const img = d.heroImage && /^https?:\/\/[^\s"')]+$/.test(d.heroImage) ? `url("${d.heroImage}")` : "none";
    const dim = Math.min(Math.max(Number(d.heroDim ?? 30), 0), 80) / 100;
    css += `--hero-bg:${safe(d.heroBg, "#F2B632")};--hero-fg:${safe(d.heroText, "#1C1915")};--hero-accent:${safe(d.heroAccent, "#1D5C3F")};--hero-accent-fg:${onColor(safe(d.heroAccent, "#1D5C3F"))};--hero-image:${img};--hero-dim:${img === "none" ? 0 : dim};`;
  }
  return css + "}";
}
