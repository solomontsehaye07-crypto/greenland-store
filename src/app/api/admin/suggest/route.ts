import { NextResponse } from "next/server";
import { assertStaff } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uniq = (xs: (string | null | undefined)[]) =>
  Array.from(new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));

/** Existing values that the admin fields suggest (brands, countries, carriers, contact people …). */
export async function GET() {
  try {
    await assertStaff();
  } catch {
    return NextResponse.json({}, { status: 401 });
  }
  const sb = supabaseAdmin();
  const [{ data: ps }, { data: sm }, { data: sups }] = await Promise.all([
    sb.from("products").select("brand, country").limit(5000),
    sb.from("shipping_methods").select("carrier"),
    sb.from("suppliers").select("contact_name, email, whatsapp").eq("active", true),
  ]);
  const brand = uniq((ps ?? []).map((p) => p.brand));
  const country = uniq((ps ?? []).map((p) => p.country));
  return NextResponse.json(
    {
      brand,
      country,
      carrier: uniq([...(sm ?? []).map((m) => m.carrier), "DHL", "DPD", "GLS", "Hermes", "UPS", "GO! Express"]),
      contact_name: uniq((sups ?? []).map((s) => s.contact_name)),
    },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
