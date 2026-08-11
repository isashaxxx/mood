import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { budget, deals, leads, metaStats, syncLog } from "@/db/schema";
import { WON, LOST, OPEN_STAGES } from "./taxonomy";
import type { MetricsFilters } from "./metrics-filters";

export const MARGIN = Number(process.env.NEXT_PUBLIC_MARGIN ?? 0.1526);

export type Filters = MetricsFilters;

export type SourceRow = {
  source: string;
  pipeline: number; // budget of every deal in the cohort, any stage
  pipelineCount: number;
  won: number;
  wonCount: number;
  lost: number;
  lostCount: number;
  avgCycleDays: number | null;
};

export type MonthRow = SourceRow & { month: string };

/** One company, one source and one reporting month. The client decides which
 * exact month/source is active, so the table follows the same filters as KPI
 * cards instead of silently mixing companies from other selections. */
export type ClientRow = {
  month: string;
  source: string;
  company: string;
  won: number;
  wonCount: number;
  openPipeline: number;
  openCount: number;
};

/**
 * Everything is measured on the COHORT month — the month the request arrived
 * (Дата - Запит), not the month the deal closed. A deal opened in May and won
 * in August belongs to May, because May is the month marketing paid for it.
 */
export async function dealsBySource(f: Filters): Promise<SourceRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      source: deals.source,
      // Pipeline is only the live part of the funnel. Won and lost deals are
      // revenue/history, not an amount a sales manager can still close.
      pipeline: sql<number>`coalesce(sum(${deals.budget}) filter (where ${inArray(deals.stage, OPEN_STAGES)}), 0)`,
      pipelineCount: sql<number>`count(*) filter (where ${inArray(deals.stage, OPEN_STAGES)})`,
      won: sql<number>`coalesce(sum(${deals.budget}) filter (where ${deals.stage} = ${WON}), 0)`,
      wonCount: sql<number>`count(*) filter (where ${deals.stage} = ${WON})`,
      lost: sql<number>`coalesce(sum(${deals.budget}) filter (where ${deals.stage} = ${LOST}), 0)`,
      lostCount: sql<number>`count(*) filter (where ${deals.stage} = ${LOST})`,
      avgCycleDays: sql<number | null>`avg(${deals.wonAt} - ${deals.requestedAt}) filter (where ${deals.stage} = ${WON} and ${deals.requestedAt} is not null)`,
    })
    .from(deals)
    .where(
      f.source
        ? and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to), eq(deals.source, f.source))
        : and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to))
    )
    .groupBy(deals.source)
    .orderBy(sql`2 desc`);
  return rows.map(cast);
}

export async function dealsByMonth(f: Filters): Promise<MonthRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      month: deals.cohortMonth,
      source: deals.source,
      pipeline: sql<number>`coalesce(sum(${deals.budget}) filter (where ${inArray(deals.stage, OPEN_STAGES)}), 0)`,
      pipelineCount: sql<number>`count(*) filter (where ${inArray(deals.stage, OPEN_STAGES)})`,
      won: sql<number>`coalesce(sum(${deals.budget}) filter (where ${deals.stage} = ${WON}), 0)`,
      wonCount: sql<number>`count(*) filter (where ${deals.stage} = ${WON})`,
      lost: sql<number>`coalesce(sum(${deals.budget}) filter (where ${deals.stage} = ${LOST}), 0)`,
      lostCount: sql<number>`count(*) filter (where ${deals.stage} = ${LOST})`,
      avgCycleDays: sql<number | null>`avg(${deals.wonAt} - ${deals.requestedAt}) filter (where ${deals.stage} = ${WON} and ${deals.requestedAt} is not null)`,
    })
    .from(deals)
    .where(
      f.source
        ? and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to), eq(deals.source, f.source))
        : and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to))
    )
    .groupBy(deals.cohortMonth, deals.source)
    .orderBy(deals.cohortMonth);
  return rows.map((r) => ({ ...cast(r), month: r.month }));
}

/**
 * Company-level figures for the "Top clients" card. Revenue is deliberately
 * limited to won deals, while the second number is an open sales opportunity.
 * That keeps prospects and lost deals out of a customer-revenue ranking.
 */
export async function clientsByMonth(f: Filters): Promise<ClientRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      month: deals.cohortMonth,
      source: deals.source,
      company: sql<string>`coalesce(nullif(trim(${deals.company}), ''), 'Без назви')`,
      won: sql<number>`coalesce(sum(${deals.budget}) filter (where ${deals.stage} = ${WON}), 0)`,
      wonCount: sql<number>`count(*) filter (where ${deals.stage} = ${WON})`,
      openPipeline: sql<number>`coalesce(sum(${deals.budget}) filter (where ${inArray(deals.stage, OPEN_STAGES)}), 0)`,
      openCount: sql<number>`count(*) filter (where ${inArray(deals.stage, OPEN_STAGES)})`,
    })
    .from(deals)
    .where(
      f.source
        ? and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to), eq(deals.source, f.source))
        : and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to))
    )
    .groupBy(deals.cohortMonth, deals.source, deals.company);

  return rows.map((row) => ({
    ...row,
    won: Number(row.won),
    wonCount: Number(row.wonCount),
    openPipeline: Number(row.openPipeline),
    openCount: Number(row.openCount),
  }));
}

export type LeadRow = {
  month: string;
  channel: string;
  source: string;
  total: number;
  nql: number;
  iql: number;
  mql: number;
  sql_: number;
  junk: number;
  toSales: number;
  handlingHours: number | null;
  handlingCount: number;
};

export async function leadBreakdown(f: Filters): Promise<LeadRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      month: leads.month,
      channel: leads.channel,
      source: leads.source,
      total: sql<number>`count(*)`,
      nql: sql<number>`count(*) filter (where ${leads.qualification} = 'NQL')`,
      iql: sql<number>`count(*) filter (where ${leads.qualification} = 'IQL')`,
      mql: sql<number>`count(*) filter (where ${leads.qualification} = 'MQL')`,
      sql_: sql<number>`count(*) filter (where ${leads.qualification} = 'SQL')`,
      junk: sql<number>`count(*) filter (where ${leads.stage} in ('Спам','Нецільовий'))`,
      toSales: sql<number>`count(*) filter (where ${leads.stage} = 'Передано Sales')`,
      handlingHours: sql<number | null>`avg(${leads.handlingHours})`,
      handlingCount: sql<number>`count(${leads.handlingHours})`,
    })
    .from(leads)
    .where(
      f.source
        ? and(gte(leads.month, f.from), lte(leads.month, f.to), eq(leads.source, f.source))
        : and(gte(leads.month, f.from), lte(leads.month, f.to))
    )
    .groupBy(leads.month, leads.channel, leads.source);
  return rows.map((r) => ({
    ...r,
    channel: r.channel ?? "Не вказано",
    total: Number(r.total),
    nql: Number(r.nql),
    iql: Number(r.iql),
    mql: Number(r.mql),
    sql_: Number(r.sql_),
    junk: Number(r.junk),
    toSales: Number(r.toSales),
    handlingHours: r.handlingHours === null ? null : Number(r.handlingHours),
    handlingCount: Number(r.handlingCount),
  }));
}

export async function spend(f: Filters) {
  const sourceChannels = f.source
    ? Object.entries(SPEND_TO_SOURCE)
        .filter(([, source]) => source === f.source)
        .map(([channel]) => channel)
    : null;

  // A source without a directly attributable budget must not inherit the
  // total advertising/overhead spend when it is the active source filter.
  if (sourceChannels && sourceChannels.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      month: budget.month,
      channel: budget.channel,
      amountUah: budget.amountUah,
      amountUsd: budget.amountUsd,
      fxRate: budget.fxRate,
    })
    .from(budget)
    .where(
      sourceChannels
        ? and(gte(budget.month, f.from), lte(budget.month, f.to), inArray(budget.channel, sourceChannels))
        : and(gte(budget.month, f.from), lte(budget.month, f.to))
    )
    .orderBy(budget.month);
  return rows;
}

export async function meta(f: Filters) {
  // Meta delivery metrics describe the paid Instagram channel only. Returning
  // them for a different selected source would make the source view additive.
  if (f.source && f.source !== SPEND_TO_SOURCE.meta) return [];

  const db = getDb();
  return db
    .select()
    .from(metaStats)
    .where(and(gte(metaStats.month, f.from), lte(metaStats.month, f.to)))
    .orderBy(metaStats.month);
}

export async function lastSync() {
  const db = getDb();
  const [row] = await db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(1);
  return row ?? null;
}

/** postgres returns numerics as strings; normalise once at the boundary. */
function cast<T extends Record<string, unknown>>(r: T) {
  return {
    ...r,
    pipeline: Number(r.pipeline),
    pipelineCount: Number(r.pipelineCount),
    won: Number(r.won),
    wonCount: Number(r.wonCount),
    lost: Number(r.lost),
    lostCount: Number(r.lostCount),
    avgCycleDays: r.avgCycleDays === null ? null : Number(r.avgCycleDays),
  } as unknown as SourceRow;
}

/** Which spend line belongs to which normalised source. */
export const SPEND_TO_SOURCE: Record<string, string | null> = {
  meta: "Instagram Paid",
  google_ads: "Google PPC",
  seo: "Google Organic",
  specialist: null, // overhead — counted in the total, never per channel
};
