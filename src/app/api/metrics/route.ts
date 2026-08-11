import { NextResponse } from "next/server";
import {
  clientsByMonth, dealsByMonth, dealsBySource, lastSync, leadBreakdown,
} from "@/lib/metrics";
import { userFromRequest } from "@/lib/auth";
import { currentReportingMonth, MetricsFilterError, parseMetricsFilters } from "@/lib/metrics-filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await userFromRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let f;

  try {
    f = parseMetricsFilters(url.searchParams);
  } catch (error) {
    const message = error instanceof MetricsFilterError ? error.message : "Некоректні параметри фільтра.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const [bySource, clients, byMonth, leads, sync] = await Promise.all([
      dealsBySource(f), clientsByMonth(f), dealsByMonth(f), leadBreakdown(f), lastSync(),
    ]);

    return NextResponse.json({
      filters: f,
      currentMonth: currentReportingMonth(),
      bySource,
      byMonth,
      clients,
      leads,
      sync,
    });
  } catch (error) {
    console.error("Metrics API failed", error);
    return NextResponse.json(
      { error: "Не вдалося прочитати підготовлені Excel-дані." },
      { status: 503 }
    );
  }
}
