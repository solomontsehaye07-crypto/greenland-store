// What kind of goods a supplier has. Shown as a sign (icon + colour) next to the supplier everywhere.
// Colours follow the same families as the Manager app.

export const SUPPLIER_TYPES = [
  { key: "mixed", label: "Mixed food", icon: "🛒", bg: "#1e7a4c" },
  { key: "african", label: "African food", icon: "🌍", bg: "#a85f0f" },
  { key: "asian", label: "Asian food", icon: "🥢", bg: "#b83227" },
  { key: "indian", label: "Indian & Pakistani", icon: "🍛", bg: "#b4521b" },
  { key: "middleeast", label: "Persian & Middle East", icon: "🫖", bg: "#7a5230" },
  { key: "latin", label: "Latin American", icon: "🌮", bg: "#94431a" },
  { key: "fish", label: "Fish & seafood", icon: "🐟", bg: "#1c4c86" },
  { key: "frozen", label: "Frozen", icon: "❄️", bg: "#2d6fb7" },
  { key: "spices", label: "Spices", icon: "🌶️", bg: "#a23e3e" },
  { key: "rice", label: "Rice, flour & grains", icon: "🌾", bg: "#8a6d1e" },
  { key: "nuts", label: "Dried fruit & nuts", icon: "🥜", bg: "#6b5a2e" },
  { key: "drinks", label: "Drinks", icon: "🥤", bg: "#0f6b5c" },
  { key: "cosmetics", label: "Cosmetics & skin care", icon: "💄", bg: "#a23e8c" },
  { key: "hair", label: "Hair & wigs", icon: "💇", bg: "#7b4fa8" },
  { key: "nonfood", label: "Household & non-food", icon: "🧹", bg: "#55606e" },
] as const;

export type SupplierTypeKey = (typeof SUPPLIER_TYPES)[number]["key"];
const BY_KEY = new Map<string, (typeof SUPPLIER_TYPES)[number]>(SUPPLIER_TYPES.map((t) => [t.key, t]));
export const supplierType = (k: string) => BY_KEY.get(k);
export const validTypes = (xs: unknown[]) => xs.map(String).filter((k) => BY_KEY.has(k));
