import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deals, leads, syncLog } from "@/db/schema";
import { LOST, OPEN_STAGES, WON } from "./taxonomy";
import type { MetricsFilters } from "./metrics-filters";

/**
 * The private project database is populated only from the two uploaded 2026
 * Excel files.  There is intentionally no NetHunt client, CRM sync, budget,
 * or ad-platform query in this reporting layer.
 */

export type Filters = MetricsFilters;

export type SourceRow = {
  source: string;
  pipeline: number;
  pipelineCount: number;
  won: number;
  wonCount: number;
  lost: number;
  lostCount: number;
  avgCycleDays: number | null;
};

export type MonthRow = SourceRow & { month: string };

export type ClientRow = {
  month: string;
  source: string;
  company: string;
  won: number;
  wonCount: number;
  openPipeline: number;
  openCount: number;
};

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

const dealFilter = (f: Filters) =>
  f.source
    ? and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to), eq(deals.source, f.source))
    : and(gte(deals.cohortMonth, f.from), lte(deals.cohortMonth, f.to));

const leadFilter = (f: Filters) =>
  f.source
    ? and(gte(leads.month, f.from), lte(leads.month, f.to), eq(leads.source, f.source))
    : and(gte(leads.month, f.from), lte(leads.month, f.to));

export async function dealsBySource(f: Filters): Promise<SourceRow[]> {
  const db = getDb();
  const rows = await db
    .select({
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
    .where(dealFilter(f))
    .groupBy(deals.source)
    .orderBy(sql`2 desc`);
  return rows.map(castDealTotals);
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
    .where(dealFilter(f))
    .groupBy(deals.cohortMonth, deals.source)
    .orderBy(deals.cohortMonth, deals.source);
  return rows.map((row) => ({ ...castDealTotals(row), month: row.month }));
}

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
    .where(dealFilter(f))
    .groupBy(deals.cohortMonth, deals.source, deals.company);
  return rows.map((row) => ({
    ...row,
    won: Number(row.won),
    wonCount: Number(row.wonCount),
    openPipeline: Number(row.openPipeline),
    openCount: Number(row.openCount),
  }));
}

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
    .where(leadFilter(f))
    .groupBy(leads.month, leads.channel, leads.source)
    .orderBy(leads.month, leads.source, leads.channel);
  return rows.map((row) => ({
    ...row,
    channel: row.channel ?? "Не вказано",
    total: Number(row.total),
    nql: Number(row.nql),
    iql: Number(row.iql),
    mql: Number(row.mql),
    sql_: Number(row.sql_),
    junk: Number(row.junk),
    toSales: Number(row.toSales),
    handlingHours: row.handlingHours === null ? null : Number(row.handlingHours),
    handlingCount: Number(row.handlingCount),
  }));
}

export async function lastSync() {
  const db = getDb();
  const [row] = await db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(1);
  if (!row) return null;
  return {
    finishedAt: row.finishedAt,
    status: row.status,
    trigger: row.trigger ?? "excel",
    dealsUpserted: row.dealsUpserted,
    leadsUpserted: row.leadsUpserted,
    unknownSources: row.unknownSources ? JSON.parse(row.unknownSources) : [],
    sources: { deals: "Угоди_2026 - 11_08.xlsx", leads: "All leads.xlsx" },
  };
}

function castDealTotals<T extends Record<string, unknown>>(row: T): SourceRow {
  return {
    source: String(row.source),
    pipeline: Number(row.pipeline),
    pipelineCount: Number(row.pipelineCount),
    won: Number(row.won),
    wonCount: Number(row.wonCount),
    lost: Number(row.lost),
    lostCount: Number(row.lostCount),
    avgCycleDays: row.avgCycleDays === null ? null : Number(row.avgCycleDays),
  };
}
