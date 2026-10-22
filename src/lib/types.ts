export type Department = "food" | "beauty" | "home";

export interface Category {
  id: number;
  slug: string;
  title: string;
  title_de: string | null;
  description: string | null;
  parent_id: number | null;
  department: Department;
  sort: number;
  image_url: string | null;
}

export interface Product {
  id: number;
  sku: string;
  slug: string;
  title: string;
  title_de: string | null;
  brand: string | null;
  description: string | null;
  category_id: number | null;
  price: number;
  compare_at_price: number | null;
  sale_ends_at?: string | null;
  qty_discount?: boolean;
  bullets_de?: string[];
  bullets_en?: string[];
  size_group?: string | null;
  ingredients?: string | null;
  cost_price?: number | null;
  tax_rate: number;
  weight_g: number;
  size_qty: number | null;
  size_unit: "g" | "ml" | null;
  image_url: string | null;
  images: string[];
  country: string | null;
  is_frozen: boolean;
  age_restricted: boolean;
  is_dropship: boolean;
  supplier_id: number | null;
  status: "active" | "hidden" | "draft";
  featured: boolean;
  stock: number;
  reorder_point: number;
  reorder_qty: number;
}

export interface ShippingMethod {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: "parcel" | "frozen" | "local" | "pickup" | "dropship";
  price: number;
  free_from: number | null;
  min_order: number;
  max_weight_g: number | null;
  countries: string[];
  postal_prefixes: string[] | null;
  active: boolean;
  sort: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferred_channel: "email" | "whatsapp" | "both";
  lead_time_days: number;
  min_order_value: number;
  address: string | null;
  is_dropshipper: boolean;
  notes: string | null;
  active: boolean;
  website?: string | null;
  country?: string | null;
  specialties?: string[];
}

export interface CartLine {
  id: number;
  slug: string;
  sku: string;
  title: string;
  price: number;
  image_url: string | null;
  qty: number;
  weight_g: number;
  is_frozen: boolean;
  age_restricted: boolean;
  /** false = no quantity discount for this product (missing = allowed; the server decides anyway) */
  qd?: boolean;
}

export const PRODUCT_CARD_FIELDS =
  "id, sku, slug, title, title_de, brand, price, compare_at_price, image_url, size_qty, size_unit, stock, is_frozen, age_restricted, weight_g, category_id, country, featured, sale_ends_at, qty_discount";
