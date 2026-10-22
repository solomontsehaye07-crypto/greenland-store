// Describes every editable thing on the website: the home page sections, the site settings and the theme.
// The admin editor builds its forms from these field lists, so adding a field here makes it editable there.

import type { L10n } from "./i18n";

export type FieldKind =
  | "text" // one line, both languages
  | "textarea" // a few lines, both languages
  | "markdown" // long text with simple formatting, both languages
  | "plain" // one line, same in both languages (links, numbers as text)
  | "image"
  | "number"
  | "color"
  | "toggle"
  | "select"
  | "category"
  | "products" // hand-picked products (list of ids)
  | "list";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  help?: string;
  options?: { value: string; label: string }[];
  item?: Field[]; // for lists
  itemLabel?: string;
  max?: number;
}

export const ACCENTS = [
  { value: "terra", label: "Terracotta" },
  { value: "saffron", label: "Saffron" },
  { value: "forest", label: "Forest green" },
  { value: "indigo", label: "Indigo" },
  { value: "sand", label: "Sand" },
];

/** Background band of a section. Light bands hold product cards; dark ones suit text and feature sections. */
const BAND: Field = {
  key: "color",
  label: "Background band",
  kind: "select",
  options: [
    { value: "none", label: "Paper (plain)" },
    { value: "sand", label: "Sand" },
    { value: "saffron", label: "Saffron" },
    { value: "forest", label: "Forest green" },
    { value: "indigo", label: "Indigo" },
    { value: "terra", label: "Terracotta" },
    { value: "ink", label: "Dark (ink)" },
  ],
};

const ICONS = [
  { value: "truck", label: "Delivery truck" },
  { value: "bag", label: "Shopping bag / pickup" },
  { value: "bike", label: "Local delivery" },
  { value: "snow", label: "Frozen" },
  { value: "leaf", label: "Fresh" },
  { value: "chat", label: "Chat / WhatsApp" },
  { value: "shield", label: "Guarantee" },
  { value: "star", label: "Star" },
  { value: "gift", label: "Gift" },
];

export type SectionType = "hero" | "marquee" | "tiles" | "products" | "offers" | "scene" | "banners" | "usp" | "story" | "faq" | "newsletter" | "text" | "countries" | "recipes" | "reviews";

export interface SectionDef {
  type: SectionType;
  label: string;
  description: string;
  fields: Field[];
  defaults: Record<string, unknown>;
}

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "hero",
    label: "Hero",
    description: "The opening area: a big headline, two buttons, live shop numbers and moving product photos. Its colours and background photo come from the active design (Designs & seasons).",
    fields: [
      { key: "title", label: "Headline", kind: "text" },
      { key: "text", label: "Intro text", kind: "textarea" },
      { key: "cta1Label", label: "Main button text", kind: "text" },
      { key: "cta1Href", label: "Main button link", kind: "plain", help: "For example /c/food" },
      { key: "cta2Label", label: "Second button text", kind: "text" },
      { key: "cta2Href", label: "Second button link", kind: "plain" },
      {
        key: "images",
        label: "Your own photos in the moving columns (optional)",
        kind: "list",
        itemLabel: "Photo",
        max: 16,
        item: [
          { key: "image", label: "Photo", kind: "image" },
          { key: "href", label: "Link (optional)", kind: "plain" },
        ],
      },
      { key: "showProducts", label: "Show moving product photos (switch off to show only the design’s background photo)", kind: "toggle" },
      { key: "flagStrip", label: "Moving strip of country flags under the hero", kind: "toggle" },
      {
        key: "slides",
        label: "Background photos that fade into each other (2–5; empty = the design’s photo)",
        kind: "list",
        itemLabel: "Photo",
        max: 5,
        item: [
          { key: "image", label: "Photo (landscape, at least 1800 px wide)", kind: "image" },
          { key: "position", label: "Keep visible when cropped (e.g. center, left, 70% 50%)", kind: "plain" },
        ],
      },
      { key: "autoFill", label: "Fill the moving photos with recommended products", kind: "toggle" },
    ],
    defaults: { title: { de: "", en: "" }, images: [], facts: [], autoFill: true, showProducts: true },
  },
  {
    type: "marquee",
    label: "Moving text line",
    description: "A thin, slowly scrolling line with short messages like free delivery or pickup.",
    fields: [
      { key: "items", label: "Messages", kind: "list", itemLabel: "Message", max: 8, item: [{ key: "text", label: "Message", kind: "text" }] },
      { key: "color", label: "Colour", kind: "select", options: ACCENTS },
      { key: "seconds", label: "Speed (seconds per loop, higher is slower)", kind: "number" },
    ],
    defaults: { items: [], color: "saffron", seconds: 40 },
  },
  {
    type: "tiles",
    label: "Category tiles",
    description: "A grid of small image tiles that link anywhere: categories, regions, offers.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      BAND,
      { key: "shape", label: "Tile shape", kind: "select", options: [{ value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "circle", label: "Circle" }] },
      {
        key: "items",
        label: "Tiles",
        kind: "list",
        itemLabel: "Tile",
        max: 16,
        item: [
          { key: "image", label: "Image", kind: "image" },
          { key: "label", label: "Label", kind: "text" },
          { key: "href", label: "Link", kind: "plain" },
          { key: "color", label: "Background", kind: "select", options: ACCENTS },
        ],
      },
    ],
    defaults: { shape: "square", items: [], color: "none" },
  },
  {
    type: "products",
    label: "Product section",
    description: "Customer favourites, recommendations, new arrivals, offers, a category or a country, as a row or a grid.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      {
        key: "source",
        label: "Which products",
        kind: "select",
        options: [
          { value: "picked", label: "Products you choose (pick them below)" },
          { value: "bestsellers", label: "Customer favourites (best sellers, topped up with your recommendations)" },
          { value: "recommended", label: "Recommendations (products marked Featured)" },
          { value: "newest", label: "New products" },
          { value: "sale", label: "Products on offer" },
          { value: "category", label: "From a category" },
          { value: "country", label: "From a country" },
        ],
      },
      { key: "productIds", label: "Your products (when “Products you choose”)", kind: "products", max: 24, help: "You can also tick this section in a product’s editor under “Show on the home page”." },
      { key: "category", label: "Category (also narrows favourites and recommendations)", kind: "category" },
      { key: "country", label: "Country (if 'From a country'), e.g. Ghana", kind: "plain" },
      { key: "limit", label: "How many", kind: "number" },
      { key: "layout", label: "Layout", kind: "select", options: [{ value: "row", label: "Scrollable row" }, { value: "grid", label: "Grid" }] },
      {
        key: "motion",
        label: "Row moves by itself",
        kind: "select",
        options: [
          { value: "step", label: "Card by card (default)" },
          { value: "back", label: "Card by card, from the right" },
          { value: "glide", label: "Slow, continuous glide" },
          { value: "off", label: "Off" },
        ],
      },
      { key: "linkLabel", label: "Link text on the right (optional)", kind: "text" },
      { key: "linkHref", label: "Link (optional, e.g. /shop?sort=new)", kind: "plain" },
      { ...BAND, help: "Green, indigo and terracotta show here as a light tint so the product cards stay readable." },
    ],
    defaults: { source: "bestsellers", limit: 10, layout: "row", color: "none" },
  },
  {
    type: "offers",
    label: "Offers (Angebote)",
    description: "A bright section with every product on offer: big discount badge, the old price crossed out and the new price in red.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "badge", label: "Sticker text (e.g. Nur diese Woche)", kind: "text" },
      {
        key: "source",
        label: "Which products",
        kind: "select",
        options: [
          { value: "auto", label: "Every product with an offer price (biggest discount first)" },
          { value: "picked", label: "Only the products I choose" },
        ],
      },
      { key: "productIds", label: "Your products (when “Only the products I choose”)", kind: "products", max: 24, help: "Only products with an offer price are shown. Set offer prices in Products." },
      { key: "limit", label: "How many at most", kind: "number" },
      {
        key: "color",
        label: "Colour",
        kind: "select",
        options: [
          { value: "terra", label: "Red & saffron" },
          { value: "saffron", label: "Saffron & red" },
          { value: "forest", label: "Green & saffron" },
          { value: "indigo", label: "Indigo & saffron" },
          { value: "ink", label: "Dark & saffron" },
        ],
      },
    ],
    defaults: { title: { de: "Angebote", en: "Offers" }, text: { de: "Solange der Vorrat reicht.", en: "While stocks last." }, source: "auto", limit: 12, color: "terra", productIds: [] },
  },
  {
    type: "scene",
    label: "Scroll scene (photos behind the page)",
    description: "Big photos stay still in the background while text cards scroll over them; the photo changes with each card as you scroll up or down.",
    fields: [
      {
        key: "steps",
        label: "Scenes",
        kind: "list",
        itemLabel: "Scene",
        max: 6,
        item: [
          { key: "image", label: "Background photo (landscape, at least 1600 px wide)", kind: "image" },
          { key: "title", label: "Title", kind: "text" },
          { key: "text", label: "Text", kind: "textarea" },
          { key: "ctaLabel", label: "Button text (optional)", kind: "text" },
          { key: "ctaHref", label: "Button link", kind: "plain" },
        ],
      },
      { key: "align", label: "Card position", kind: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }] },
      { key: "dim", label: "Darken the photos (0–80 %, makes text easier to read)", kind: "number" },
    ],
    defaults: { steps: [], align: "left", dim: 30 },
  },
  {
    type: "banners",
    label: "Promo banners",
    description: "One to three large banners with a photo, a short text and a button.",
    fields: [
      {
        key: "items",
        label: "Banners",
        kind: "list",
        itemLabel: "Banner",
        max: 3,
        item: [
          { key: "image", label: "Photo", kind: "image" },
          { key: "title", label: "Title", kind: "text" },
          { key: "text", label: "Text", kind: "textarea" },
          { key: "ctaLabel", label: "Button text", kind: "text" },
          { key: "href", label: "Link", kind: "plain" },
          { key: "color", label: "Colour", kind: "select", options: ACCENTS },
        ],
      },
    ],
    defaults: { items: [] },
  },
  {
    type: "usp",
    label: "Why shop with us",
    description: "A trust bar with icons: delivery, pickup, freshness, support. Works best right under the hero.",
    fields: [
      { key: "title", label: "Title (optional, only read out by screen readers)", kind: "text" },
      BAND,
      {
        key: "items",
        label: "Promises",
        kind: "list",
        itemLabel: "Promise",
        max: 6,
        item: [
          { key: "icon", label: "Icon", kind: "select", options: ICONS },
          { key: "title", label: "Title", kind: "text" },
          { key: "text", label: "Text", kind: "textarea" },
        ],
      },
    ],
    defaults: { items: [] },
  },
  {
    type: "story",
    label: "Story",
    description: "A photo with a longer text: who you are, a recipe, a special product.",
    fields: [
      { key: "image", label: "Photo", kind: "image" },
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "markdown" },
      { key: "ctaLabel", label: "Button text", kind: "text" },
      { key: "ctaHref", label: "Button link", kind: "plain" },
      { key: "imageSide", label: "Photo side", kind: "select", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] },
      BAND,
    ],
    defaults: { imageSide: "left", color: "forest" },
  },
  {
    type: "faq",
    label: "Questions & answers",
    description: "Frequently asked questions that open on click.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      BAND,
      { key: "items", label: "Questions", kind: "list", itemLabel: "Question", max: 20, item: [{ key: "q", label: "Question", kind: "text" }, { key: "a", label: "Answer", kind: "textarea" }] },
    ],
    defaults: { items: [] },
  },
  {
    type: "reviews",
    label: "Google reviews",
    description: "Your Google rating and the latest reviews, updated twice a day. Connect your Google place under Admin → Account & receipts; the section stays hidden until then.",
    fields: [{ key: "title", label: "Title", kind: "text" }, BAND],
    defaults: { color: "sand" },
  },
  {
    type: "newsletter",
    label: "Newsletter sign-up",
    description: "Collects email addresses. You find them under Admin → Subscribers.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "note", label: "Small print", kind: "textarea" },
      BAND,
    ],
    defaults: { color: "ink" },
  },
  {
    type: "countries",
    label: "Shop by country",
    description: "A spotlight for Ethiopia & Eritrea plus a flag for every country of origin, linking to the filtered shop.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      BAND,
    ],
    defaults: { color: "indigo" },
  },
  {
    type: "recipes",
    label: "Recipe ideas",
    description: "Cards for your recipes, each linking to its ingredients. Manage recipes under Admin → Recipes.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "limit", label: "How many", kind: "number" },
      BAND,
    ],
    defaults: { limit: 4, color: "saffron" },
  },
  {
    type: "text",
    label: "Text block",
    description: "A heading and free text.",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "body", label: "Text", kind: "markdown" },
      BAND,
    ],
    defaults: {},
  },
];

export function sectionDef(type: string) {
  return SECTION_DEFS.find((d) => d.type === type);
}

// ---------- site settings & theme ----------

export const SITE_FIELDS: Field[] = [
  { key: "headerLogo", label: "Header logo (full logo with name, wide format; empty = the footer logo, trimmed)", kind: "image" },
  { key: "icon", label: "Short icon (used where there is no room for the full logo)", kind: "image" },
  { key: "logo", label: "Footer logo (with the full name; leave empty to use the name as text)", kind: "image" },
  { key: "name", label: "Shop name", kind: "plain" },
  { key: "tagline", label: "Short line under the name", kind: "text" },
  { key: "announcements", label: "Top bar messages (rotate)", kind: "list", itemLabel: "Message", max: 5, item: [{ key: "text", label: "Message", kind: "text" }] },
  { key: "whatsapp", label: "WhatsApp number (international, digits only, e.g. 4915213945662)", kind: "plain" },
  { key: "phone", label: "Phone (as shown)", kind: "plain" },
  { key: "email", label: "Email", kind: "plain" },
  { key: "address", label: "Shop address", kind: "textarea" },
  { key: "hours", label: "Opening hours", kind: "textarea" },
  { key: "about", label: "Footer: about the shop", kind: "textarea" },
  { key: "instagram", label: "Instagram link", kind: "plain" },
  { key: "facebook", label: "Facebook link", kind: "plain" },
  { key: "tiktok", label: "TikTok link", kind: "plain" },
  { key: "navLinks", label: "Extra menu links", kind: "list", itemLabel: "Link", max: 5, item: [{ key: "label", label: "Text", kind: "text" }, { key: "href", label: "Link", kind: "plain" }] },
  { key: "seoTitle", label: "Search engine title", kind: "text" },
  { key: "seoDescription", label: "Search engine description", kind: "textarea" },
  { key: "showWhatsappButton", label: "Show floating WhatsApp button", kind: "toggle" },
  { key: "welcomePopup", label: "Show the welcome offer pop-up (10 % for new sign-ups)", kind: "toggle" },
  { key: "welcomePhoto", label: "Photo in the welcome pop-up", kind: "image" },
];

export const THEME_FIELDS: Field[] = [
  { key: "paper", label: "Page background", kind: "color" },
  { key: "sand", label: "Soft band colour", kind: "color" },
  { key: "ink", label: "Text colour", kind: "color" },
  { key: "terra", label: "Terracotta (food)", kind: "color" },
  { key: "saffron", label: "Saffron (highlights)", kind: "color" },
  { key: "forest", label: "Forest green (brand, buttons)", kind: "color" },
  { key: "indigo", label: "Indigo (beauty)", kind: "color" },
  { key: "pattern", label: "Show woven stripe pattern", kind: "toggle" },
];

export const DEFAULT_THEME = {
  paper: "#FBFAF7",
  sand: "#EFE9DF",
  ink: "#1C1915",
  terra: "#B5482A",
  saffron: "#E5A532",
  forest: "#1D5C3F",
  indigo: "#2C3A73",
  pattern: true,
};
export type Theme = typeof DEFAULT_THEME;

export interface SiteSettings {
  icon?: string;
  logo?: string;
  headerLogo?: string;
  name?: string;
  tagline?: L10n;
  announcements?: { text: L10n }[];
  whatsapp?: string;
  phone?: string;
  email?: string;
  address?: L10n;
  hours?: L10n;
  about?: L10n;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  navLinks?: { label: L10n; href: string }[];
  seoTitle?: L10n;
  seoDescription?: L10n;
  showWhatsappButton?: boolean;
  welcomePopup?: boolean;
  welcomePhoto?: string;
}
