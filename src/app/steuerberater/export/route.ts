import { NextResponse } from "next/server";
import { assertAdvisor } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccountingSettings, getOnlineMonth, getShopMonth, parseMonth } from "@/lib/cashbook";
import { onlineDatev, onlineXlsx, shopDatev, shopXlsx } from "@/lib/cashbook-export";

export const dynamic = "force-dynamic";

// /steuerberater/export?book=shop|online&m=2026-10&format=xlsx|datev
export async function GET(req: Request) {
  try {
    await assertAdvisor();
  } catch {
    return NextResponse.json({ error: "Kein Zugang" }, { status: 401 });
  }
  const u = new URL(req.url);
  const book = u.searchParams.get("book") === "online" ? "online" : "shop";
  const format = u.searchParams.get("format") === "datev" ? "datev" : "xlsx";
  const { year, month } = parseMonth(u.searchParams.get("m"));
  const [acc, { data: st }] = await Promise.all([getAccountingSettings(), supabaseAdmin().from("settings").select("value").eq("key", "public.store").maybeSingle()]);
  const store = { name: ((st?.value ?? {}) as { name?: string }).name || "Greenland Afro Asia Store" };
  const mm = String(month).padStart(2, "0");
  const base = `Greenland-${book === "shop" ? "Kassenbuch" : "Online"}-${year}-${mm}`;
  let body: Uint8Array;
  if (book === "shop") {
    const m = await getShopMonth(year, month);
    body = format === "xlsx" ? shopXlsx(m, store, acc) : shopDatev(m, acc);
  } else {
    const m = await getOnlineMonth(year, month);
    body = format === "xlsx" ? onlineXlsx(m, store) : onlineDatev(m, acc);
  }
  const type = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=windows-1252";
  const name = format === "xlsx" ? `${base}.xlsx` : `EXTF_${base}.csv`;
  return new NextResponse(Buffer.from(body), {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
