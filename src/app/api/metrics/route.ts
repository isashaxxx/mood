import { NextResponse } from "next/server";
import {
  dealsByMonth, dealsBySource, lastSync, leadBreakdown, meta, spend, MARGIN,
} from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = new Date().toISOString().slice(0, 7);
  const f = {
    from: url.searchParams.get("from") ?? "2026-01",
    to: url.searchParams.get("to") ?? now,
  };

  try {
    const [bySource, byMonth, leads, budget, metaRows, sync] = await Promise.all([
      dealsBySource(f), dealsByMonth(f), leadBreakdown(f), spend(f), meta(f), lastSync(),
    ]);

    return NextResponse.json({
      filters: f, margin: MARGIN, currentMonth: now,
      bySource, byMonth, leads, budget, meta: metaRows,
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
