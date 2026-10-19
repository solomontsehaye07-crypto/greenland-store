import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { draftRefillOrders } from "@/lib/purchasing";
import { sendEmail } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

// Runs daily (Cloudflare cron trigger in wrangler.jsonc, or vercel.json on Vercel). Creates alerts, drafts refill orders per supplier and emails a digest.
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: low } = await sb.from("low_stock").select("id, sku, title, stock, reorder_point, supplier_name, on_order");
  const { data: expiring } = await sb.from("expiring_batches").select("product_id, sku, title, best_before, quantity_left");

  const { data: open } = await sb.from("alerts").select("product_id, kind").eq("resolved", false);
  const has = new Set((open ?? []).map((a) => `${a.kind}:${a.product_id}`));
  const fresh = [
    ...(low ?? [])
      .filter((p) => !has.has(`low_stock:${p.id}`))
      .map((p) => ({ kind: "low_stock", product_id: p.id, message: `${p.title} is low: ${p.stock} left (reorder at ${p.reorder_point})` })),
    ...(expiring ?? [])
      .filter((b) => !has.has(`expiring:${b.product_id}`))
      .map((b) => ({ kind: "expiring", product_id: b.product_id, message: `${b.quantity_left} × ${b.title} expire on ${b.best_before}` })),
  ];
  if (fresh.length) await sb.from("alerts").insert(fresh);

  const drafts = await draftRefillOrders();

  const to = process.env.ALERT_EMAIL_TO;
  if (to && ((low?.length ?? 0) > 0 || (expiring?.length ?? 0) > 0)) {
    const site = siteUrl();
    const li = (low ?? []).map((p) => `<li>${p.title} (${p.sku}) – <b>${p.stock}</b> left${p.on_order ? " · on order" : ""}</li>`).join("");
    const le = (expiring ?? []).map((b) => `<li>${b.title} – ${b.quantity_left} expire ${b.best_before}</li>`).join("");
    await sendEmail({
      to,
      subject: `Stock alert: ${low?.length ?? 0} low, ${expiring?.length ?? 0} expiring`,
      html: `<h3>Low stock</h3><ul>${li || "<li>None</li>"}</ul><h3>Expiring within 30 days</h3><ul>${le || "<li>None</li>"}</ul>
             <p>${drafts.created.length} draft refill order(s) are ready to review: <a href="${site}/admin/purchase-orders">open purchase orders</a>.</p>`,
    });
  }
  return NextResponse.json({ low: low?.length ?? 0, expiring: expiring?.length ?? 0, drafts });
}
