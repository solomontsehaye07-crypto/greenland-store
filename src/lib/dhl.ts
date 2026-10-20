import "server-only";
import { supabaseAdmin } from "./supabase";
import { decryptJson, encryptJson } from "./commerce";

// ---------------------------------------------------------------------------------------------
// DHL Parcel DE Shipping API v2 (business customers): creates the shipping label from an order,
// so nobody has to type the address again in the DHL portal. The customer gets the tracking link.
// Docs: https://developer.dhl.com/api-reference/parcel-de-shipping-post-parcel-germany-v2
// Settings are stored encrypted in settings → private.dhl and edited under Admin → Shipping & pickup.
// ---------------------------------------------------------------------------------------------

export interface DhlSettings {
  enabled: boolean;
  sandbox: boolean;
  apiKey?: string; // from developer.dhl.com (app with "Parcel DE Shipping")
  user?: string; // business customer (GKP) system user
  password?: string;
  billingNumber: string; // 14 digits: EKP (10) + procedure 01 (DHL Paket) + participation (2)
  printFormat: "A4" | "910-300-700" | "910-300-600" | "910-300-300";
  auto: boolean; // create the label automatically once a parcel order is paid
  shareEmail: boolean; // pass the customer email to DHL for the parcel announcement
  extraWeightKg: number; // box and filling added to the goods weight
  sender: { name1: string; name2: string; street: string; house: string; postal: string; city: string; email: string };
}

export const DEFAULT_DHL: DhlSettings = {
  enabled: false,
  sandbox: true,
  billingNumber: "",
  printFormat: "910-300-700",
  auto: false,
  shareEmail: true,
  extraWeightKg: 0.3,
  sender: { name1: "", name2: "", street: "", house: "", postal: "", city: "", email: "" },
};

// DHL's public sandbox account (documented on developer.dhl.com) – used when sandbox is on and no own test user is set
const SANDBOX = { user: "user-valid", password: "SandboxPasswort2023!", billing: "33333333330102" };
const PROFILE = "STANDARD_GRUPPENPROFIL";

export async function getDhl(): Promise<DhlSettings> {
  const { data } = await supabaseAdmin().from("settings").select("value").eq("key", "private.dhl").maybeSingle();
  const v = (await decryptJson<Partial<DhlSettings>>(data?.value)) ?? {};
  return { ...DEFAULT_DHL, ...v, sender: { ...DEFAULT_DHL.sender, ...(v.sender ?? {}) } };
}

export async function saveDhl(v: DhlSettings) {
  const { error } = await supabaseAdmin().from("settings").upsert({ key: "private.dhl", value: await encryptJson(v) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export const dhlTrackingUrl = (no: string) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(no)}`;

/** "Hauptstraße 12a" → ["Hauptstraße", "12a"]; keeps the whole line as street when no number is found. */
export function splitStreet(line: string): [string, string] {
  const s = line.trim().replace(/\s+/g, " ");
  const m = s.match(/^(.*?)[\s,]+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)$/);
  return m ? [m[1].trim(), m[2].replace(/\s/g, "")] : [s, ""];
}

function base(c: DhlSettings) {
  return c.sandbox ? "https://api-sandbox.dhl.com/parcel/de/shipping/v2" : "https://api-eu.dhl.com/parcel/de/shipping/v2";
}

function headers(c: DhlSettings) {
  const user = c.user || (c.sandbox ? SANDBOX.user : "");
  const pass = c.password || (c.sandbox ? SANDBOX.password : "");
  if (!c.apiKey) throw new Error("DHL API key is missing (Admin → Shipping & pickup → DHL).");
  if (!user || !pass) throw new Error("DHL business customer user and password are missing.");
  return {
    "dhl-api-key": c.apiKey,
    Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "de-DE",
  };
}

type DhlItem = {
  shipmentNo?: string;
  sstatus?: { statusCode: number; title: string; detail?: string };
  label?: { b64?: string; url?: string };
  validationMessages?: { property?: string; validationMessage?: string; validationState?: string }[];
};

function explain(json: unknown, http: number) {
  const j = json as { status?: { title?: string; detail?: string }; items?: DhlItem[]; title?: string; detail?: string } | null;
  const it = j?.items?.[0];
  const msgs = (it?.validationMessages ?? []).filter((m) => m.validationState !== "Warning").map((m) => `${m.property ? m.property + ": " : ""}${m.validationMessage}`);
  return msgs.join(" · ") || it?.sstatus?.detail || it?.sstatus?.title || j?.status?.detail || j?.detail || j?.status?.title || j?.title || `DHL answered ${http}`;
}

/** Builds the DHL shipment from an order. */
async function shipmentFor(orderId: string, c: DhlSettings) {
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("id, number, email, phone, fulfillment_type, shipping_address, tracking_number, order_items(qty, product_id)").eq("id", orderId).single();
  if (!o) throw new Error("Order not found.");
  if (o.fulfillment_type !== "parcel") throw new Error("DHL labels are only for parcel orders (not pickup, local or frozen delivery).");
  const a = (o.shipping_address ?? {}) as { name?: string; street?: string; postal?: string; city?: string; country?: string };
  if (!a.name || !a.street || !a.postal || !a.city) throw new Error("The order has no complete delivery address.");
  const ids = (o.order_items as { product_id: number }[]).map((i) => i.product_id);
  const { data: ps } = await sb.from("products").select("id, weight_g").in("id", ids);
  const w = new Map((ps ?? []).map((p) => [p.id, Number(p.weight_g) || 0]));
  const goodsKg = (o.order_items as { qty: number; product_id: number }[]).reduce((t, i) => t + (w.get(i.product_id) ?? 0) * i.qty, 0) / 1000;
  const kg = Math.min(31.5, Math.max(0.1, Math.round((goodsKg + c.extraWeightKg) * 100) / 100));
  const [street, house] = splitStreet(a.street);
  const s = c.sender;
  if (!s.name1 || !s.street || !s.postal || !s.city) throw new Error("Sender address for DHL is missing (Admin → Shipping & pickup → DHL).");
  const billing = c.sandbox && !c.billingNumber ? SANDBOX.billing : c.billingNumber.replace(/\s/g, "");
  if (!/^\d{10}01[0-9A-Za-z]{2}$/.test(billing)) throw new Error("DHL billing number must be 14 characters: EKP + 01 + participation (e.g. 1234567890 01 01).");
  return {
    order: o,
    body: {
      profile: PROFILE,
      shipments: [
        {
          product: "V01PAK",
          billingNumber: billing,
          refNo: `Bestellung ${o.number}`.padEnd(8, " ").slice(0, 35),
          shipper: {
            name1: s.name1.slice(0, 50),
            ...(s.name2 ? { name2: s.name2.slice(0, 50) } : {}),
            addressStreet: s.street.slice(0, 50),
            ...(s.house ? { addressHouse: s.house.slice(0, 10) } : {}),
            postalCode: s.postal,
            city: s.city.slice(0, 40),
            country: "DEU",
            ...(s.email ? { email: s.email } : {}),
          },
          consignee: {
            name1: a.name.slice(0, 50),
            addressStreet: street.slice(0, 50),
            ...(house ? { addressHouse: house.slice(0, 10) } : {}),
            postalCode: a.postal.trim(),
            city: a.city.slice(0, 40),
            country: "DEU",
            ...(c.shareEmail && o.email ? { email: o.email } : {}),
            ...(c.shareEmail && o.phone ? { phone: String(o.phone).slice(0, 20) } : {}),
          },
          details: { weight: { uom: "kg", value: kg } },
        },
      ],
    },
  };
}

/** Creates the DHL label, stores the PDF and the tracking number on the order. */
export async function createDhlLabel(orderId: string): Promise<{ shipmentNo: string }> {
  const c = await getDhl();
  if (!c.enabled) throw new Error("DHL is not switched on (Admin → Shipping & pickup → DHL).");
  const { order, body } = await shipmentFor(orderId, c);
  if (order.tracking_number) throw new Error("This order already has a label. Cancel it first to make a new one.");
  const q = new URLSearchParams({ includeDocs: "include", docFormat: "PDF", printFormat: c.printFormat, mustEncode: "true" });
  const res = await fetch(`${base(c)}/orders?${q}`, { method: "POST", headers: headers(c), body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { items?: DhlItem[] } | null;
  const it = json?.items?.[0];
  if (!res.ok || !it?.shipmentNo || (it.sstatus && it.sstatus.statusCode >= 400)) throw new Error(explain(json, res.status));

  const sb = supabaseAdmin();
  if (it.label?.b64) {
    const bytes = Uint8Array.from(atob(it.label.b64), (ch) => ch.charCodeAt(0));
    await sb.storage.from("documents").upload(`labels/${orderId}.pdf`, bytes, { contentType: "application/pdf", upsert: true });
  }
  await sb.from("orders").update({ tracking_number: it.shipmentNo, carrier: c.sandbox ? "DHL (test)" : "DHL" }).eq("id", orderId);
  return { shipmentNo: it.shipmentNo };
}

/** Cancels a label that DHL has not processed yet (before the daily closing). */
export async function cancelDhlLabel(orderId: string) {
  const c = await getDhl();
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("tracking_number").eq("id", orderId).single();
  if (!o?.tracking_number) return;
  const q = new URLSearchParams({ profile: PROFILE, shipment: o.tracking_number });
  const res = await fetch(`${base(c)}/orders?${q}`, { method: "DELETE", headers: headers(c) });
  if (!res.ok) throw new Error(explain(await res.json().catch(() => null), res.status));
  await sb.storage.from("documents").remove([`labels/${orderId}.pdf`]);
  await sb.from("orders").update({ tracking_number: null, carrier: null }).eq("id", orderId);
}

/** Checks the connection with a validate-only request (no label is created). */
export async function testDhl(c: DhlSettings) {
  const s = c.sender;
  const billing = c.sandbox && !c.billingNumber ? SANDBOX.billing : c.billingNumber.replace(/\s/g, "");
  const body = {
    profile: PROFILE,
    shipments: [
      {
        product: "V01PAK",
        billingNumber: billing,
        refNo: "Testsendung",
        shipper: { name1: s.name1 || "Test", addressStreet: s.street || "Sträßchensweg", addressHouse: s.house || "10", postalCode: s.postal || "53113", city: s.city || "Bonn", country: "DEU" },
        consignee: { name1: "Max Mustermann", addressStreet: "Kurt-Schumacher-Str.", addressHouse: "20", postalCode: "53113", city: "Bonn", country: "DEU" },
        details: { weight: { uom: "kg", value: 1 } },
      },
    ],
  };
  const res = await fetch(`${base(c)}/orders?validate=true`, { method: "POST", headers: headers(c), body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  const it = (json as { items?: DhlItem[] } | null)?.items?.[0];
  if (!res.ok || (it?.sstatus && it.sstatus.statusCode >= 400)) throw new Error(explain(json, res.status));
  return true;
}

/** Signed link to the stored label PDF. */
export async function labelLink(orderId: string) {
  const { data } = await supabaseAdmin().storage.from("documents").createSignedUrl(`labels/${orderId}.pdf`, 60 * 30);
  return data?.signedUrl ?? null;
}
