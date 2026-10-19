import { supabasePublic } from "./supabase";
import { DEFAULT_THEME, type SiteSettings, type Theme } from "./sections";
import type { L10n } from "./i18n";

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
}

export async function getSite(): Promise<{ site: SiteSettings; theme: Theme; store: Record<string, string> }> {
  const { data } = await supabasePublic().from("settings").select("key, value").in("key", ["public.site", "public.theme", "public.store"]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value ?? {};
  return {
    site: get("public.site") as SiteSettings,
    theme: { ...DEFAULT_THEME, ...(get("public.theme") as Partial<Theme>) },
    store: get("public.store") as Record<string, string>,
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

/** CSS custom properties for the chosen theme. */
export function themeCss(t: Theme) {
  const safe = (v: string, d: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v ?? "") ? v : d);
  const D = DEFAULT_THEME;
  return `:root{--paper:${safe(t.paper, D.paper)};--sand:${safe(t.sand, D.sand)};--ink:${safe(t.ink, D.ink)};--terra:${safe(t.terra, D.terra)};--saffron:${safe(t.saffron, D.saffron)};--forest:${safe(t.forest, D.forest)};--indigo:${safe(t.indigo, D.indigo)};}`;
}
