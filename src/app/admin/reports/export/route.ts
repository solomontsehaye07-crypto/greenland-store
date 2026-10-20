import { NextResponse } from "next/server";
import { assertStaff, MANAGER_ROLES } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { buildReport, reportCsv } from "@/lib/reports";
import { buildReportPdf } from "@/lib/pdf";
import { resolvePeriod } from "../period";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await assertStaff(MANAGER_ROLES);
  } catch {
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  }
  const u = new URL(req.url);
  const per = resolvePeriod(u.searchParams.get("p") ?? undefined, u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  const format = u.searchParams.get("format") ?? "pdf";
  const r = await buildReport(per.from, per.to);
  const base = `Greenland-Bericht-${per.from}_${per.to}`;
  if (format === "csv") {
    const part = (u.searchParams.get("part") ?? "sales") as "sales" | "purchases" | "losses" | "expenses";
    const names = { sales: "Umsaetze", purchases: "Wareneingang", losses: "Warenverluste", expenses: "Ausgaben" };
    return new NextResponse(reportCsv(r, part), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}-${names[part]}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const { data } = await supabaseAdmin().from("settings").select("key, value").in("key", ["public.store", "public.receipt"]);
  const store = { ...(((data ?? []).find((x) => x.key === "public.store")?.value ?? {}) as Record<string, string>), tax_number: (((data ?? []).find((x) => x.key === "public.receipt")?.value ?? {}) as Record<string, string>).tax_number ?? "" };
  const pdf = await buildReportPdf(r, store);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${base}.pdf"`, "Cache-Control": "no-store" },
  });
}
