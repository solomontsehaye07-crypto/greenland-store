export const LEGAL_SLUGS = ["impressum", "agb", "datenschutz", "widerruf", "versand"];
export const pageHref = (slug: string) => (LEGAL_SLUGS.includes(slug) ? `/legal/${slug}` : `/info/${slug}`);
