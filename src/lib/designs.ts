// Designs: complete looks for the shop (colours, hero, top-bar message) that can be switched with one click
// or switched automatically for a season or occasion. Stored in settings → public.designs.

import type { Field } from "./sections";
import { DEFAULT_THEME, type Theme } from "./sections";
import type { L10n } from "./i18n";

export interface Design {
  id: string;
  name: string;
  heroBg: string;
  heroText: string;
  heroAccent: string;
  heroImage?: string;
  heroDim?: number; // 0–80, darkens the hero photo
  announcement?: L10n;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  yearly?: boolean; // repeat the date range every year
  paper: string;
  sand: string;
  ink: string;
  terra: string;
  saffron: string;
  forest: string;
  indigo: string;
}

export interface DesignStore {
  active: string;
  presets: Design[];
}

const base = { ...DEFAULT_THEME };
delete (base as Partial<Theme>).pattern;

export const BUILT_IN: Design[] = [
  { id: "standard", name: "Standard (marigold)", heroBg: "#F2B632", heroText: "#1C1915", heroAccent: "#1D5C3F", ...base, paper: "#FBFAF7", sand: "#EFE9DF", ink: "#1C1915", terra: "#B5482A", saffron: "#E5A532", forest: "#1D5C3F", indigo: "#2C3A73" },
  { id: "habesha-new-year", name: "Enkutatash & Meskel", heroBg: "#F7C948", heroText: "#14301F", heroAccent: "#2E7D32", from: "2026-09-08", to: "2026-09-30", yearly: true, paper: "#FBFAF2", sand: "#F1EBD3", ink: "#1A1F14", terra: "#C0392B", saffron: "#F2B705", forest: "#2E7D32", indigo: "#25406E", announcement: { de: "Melkam Addis Amet! Alles für Buna und Doro Wat.", en: "Melkam Addis Amet! Everything for buna and doro wat." } },
  { id: "ramadan-eid", name: "Ramadan & Eid", heroBg: "#1B2A4A", heroText: "#FFF8EA", heroAccent: "#E8B54A", paper: "#FAF8F3", sand: "#ECE6DA", ink: "#1A1C24", terra: "#B5482A", saffron: "#E8B54A", forest: "#1F5E4B", indigo: "#1B2A4A", announcement: { de: "Ramadan Kareem – Datteln, Reis und Gewürze für das Iftar.", en: "Ramadan Kareem – dates, rice and spices for iftar." } },
  { id: "christmas", name: "Christmas & Genna", heroBg: "#8E1C1C", heroText: "#FFF6EC", heroAccent: "#E9B949", from: "2026-11-28", to: "2027-01-08", yearly: true, paper: "#FBF8F4", sand: "#EFE6DC", ink: "#1E1715", terra: "#A62626", saffron: "#E9B949", forest: "#1E5A3C", indigo: "#2B3566", announcement: { de: "Frohe Weihnachten & Melkam Genna!", en: "Merry Christmas & Melkam Genna!" } },
  { id: "summer", name: "Summer", heroBg: "#0E7C7B", heroText: "#FFFFFF", heroAccent: "#FFB347", paper: "#F9FBFA", sand: "#E4F0EC", ink: "#132321", terra: "#E0603A", saffron: "#FFB347", forest: "#0E7C7B", indigo: "#24497A" },
  { id: "black-friday", name: "Black Friday & big sales", heroBg: "#121212", heroText: "#FFFFFF", heroAccent: "#F2B632", paper: "#FAFAF8", sand: "#ECECE8", ink: "#141414", terra: "#D7372B", saffron: "#F2B632", forest: "#1D5C3F", indigo: "#2C3A73", announcement: { de: "Black Week: Angebote im ganzen Laden.", en: "Black Week: offers across the shop." } },
];

export const DESIGN_FIELDS: Field[] = [
  { key: "name", label: "Name of the design", kind: "plain" },
  { key: "heroBg", label: "Hero background", kind: "color" },
  { key: "heroText", label: "Hero text", kind: "color" },
  { key: "heroAccent", label: "Hero button & numbers", kind: "color" },
  { key: "heroImage", label: "Hero photo (optional, stays still while the page scrolls over it)", kind: "image" },
  { key: "heroDim", label: "Darken the hero photo (0–80 %)", kind: "number" },
  { key: "announcement", label: "Top bar message while this design is on (optional)", kind: "text" },
  { key: "from", label: "Switch on automatically from (YYYY-MM-DD, optional)", kind: "plain" },
  { key: "to", label: "…until (YYYY-MM-DD)", kind: "plain" },
  { key: "yearly", label: "Repeat these dates every year", kind: "toggle" },
  { key: "paper", label: "Page background", kind: "color" },
  { key: "sand", label: "Soft band colour", kind: "color" },
  { key: "ink", label: "Text colour", kind: "color" },
  { key: "forest", label: "Brand green (buttons)", kind: "color" },
  { key: "saffron", label: "Saffron (highlights)", kind: "color" },
  { key: "terra", label: "Red (offers)", kind: "color" },
  { key: "indigo", label: "Indigo", kind: "color" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOr = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toUpperCase() : d);

/** Fills missing values from the built-in design with the same id (or Standard). */
export function normalise(d: Partial<Design>): Design {
  const ref = BUILT_IN.find((b) => b.id === d.id) ?? BUILT_IN[0];
  const out = { ...ref, ...d } as Design;
  for (const k of ["heroBg", "heroText", "heroAccent", "paper", "sand", "ink", "terra", "saffron", "forest", "indigo"] as const) out[k] = hexOr(out[k], ref[k]);
  return out;
}

export function storeFrom(raw: unknown, legacyTheme?: Partial<Theme>): DesignStore {
  const r = (raw ?? {}) as Partial<DesignStore>;
  let presets = Array.isArray(r.presets) && r.presets.length ? r.presets.map(normalise) : BUILT_IN.map((b) => ({ ...b }));
  // the old single "Colours" setting becomes the standard design's palette
  if ((!Array.isArray(r.presets) || !r.presets.length) && legacyTheme)
    presets = presets.map((p) => (p.id === "standard" ? normalise({ ...p, ...Object.fromEntries(Object.entries(legacyTheme).filter(([k]) => k !== "pattern")) }) : p));
  return { active: r.active && presets.some((p) => p.id === r.active) ? r.active : presets[0].id, presets };
}

/** Today's date in Berlin as YYYY-MM-DD. */
export function berlinToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function inRange(d: Design, today: string) {
  if (!d.from || !d.to || !/^\d{4}-\d{2}-\d{2}$/.test(d.from) || !/^\d{4}-\d{2}-\d{2}$/.test(d.to)) return false;
  if (!d.yearly) return today >= d.from && today <= d.to;
  const md = today.slice(5);
  const f = d.from.slice(5);
  const t = d.to.slice(5);
  return f <= t ? md >= f && md <= t : md >= f || md <= t; // ranges over New Year
}

/** The design shown right now: a scheduled one if today is in its dates, otherwise the one switched on by hand. */
export function currentDesign(store: DesignStore, now = new Date()): { design: Design; scheduled: boolean } {
  const today = berlinToday(now);
  const sched = store.presets.find((p) => inRange(p, today));
  if (sched) return { design: sched, scheduled: true };
  return { design: store.presets.find((p) => p.id === store.active) ?? store.presets[0], scheduled: false };
}

/** Readable text colour (dark or white) on a background. */
export function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? "#1C1915" : "#FFFFFF";
}
