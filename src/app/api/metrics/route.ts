import { NextResponse } from "next/server";
import {
  clientsByMonth, dealsByMonth, dealsBySource, lastSync, leadBreakdown, meta, spend, MARGIN,
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
    const [bySource, clients, byMonth, leads, budget, metaRows, sync] = await Promise.all([
      dealsBySource(f), clientsByMonth(f), dealsByMonth(f), leadBreakdown(f), spend(f), meta(f), lastSync(),
    ]);

    return NextResponse.json({
      filters: f, margin: MARGIN, currentMonth: currentReportingMonth(),
      bySource, byMonth, clients, leads, budget, meta: metaRows,
      sync: sync && {
        finishedAt: sync.finishedAt, status: sync.status, trigger: sync.trigger,
        dealsUpserted: sync.dealsUpserted, leadsUpserted: sync.leadsUpserted,
        unknownSources: sync.unknownSources ? JSON.parse(sync.unknownSources) : [],
      },
    });
  } catch (error) {
    console.error("Metrics API failed", error);
    return NextResponse.json(
      { error: "Дані недоступні. Перевірте підключення бази даних та первинну синхронізацію." },
      { status: 503 }
    );
  }
}
