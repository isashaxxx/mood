import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals, leads, syncLog } from "@/db/schema";
import { fetchNewRecords, fetchUpdatedRecords, type NetHuntRecord } from "./nethunt";
import { normaliseSource } from "./taxonomy";

const DEALS_FOLDER = () => process.env.NETHUNT_DEALS_FOLDER!;
const LEADS_FOLDER = () => process.env.NETHUNT_LEADS_FOLDER!;

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? str(v[0]) : null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
/** NetHunt date fields arrive either as ISO strings or epoch millis. */
const day = (v: unknown): string | null => {
  if (v == null) return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const monthOf = (d: string | null): string | null => (d ? d.slice(0, 7) : null);

export type SyncResult = {
  dealsUpserted: number;
  leadsUpserted: number;
  unknownSources: string[];
  skippedOutbound: number;
};

function mapDeal(r: NetHuntRecord, unknown: Set<string>) {
  const f = r.fields;
  const rawSource = str(f["(Джерело) Where do they know us from?"] ?? f["Джерело"]);
  const { source, isOutbound, unknown: isUnknown } = normaliseSource(rawSource);
  if (isOutbound) return null; // outbound never enters marketing reporting
  if (isUnknown && rawSource) unknown.add(rawSource);

  const requestedAt = day(f["Дата - Запит"]);
  const createdAt = r.createdAt ? new Date(r.createdAt) : null;
  const wonAt = day(f["Дата - Виграні"]);
  const lostAt = day(f["Дата - Програні"]);

  // The cohort is the month demand arrived. Falling back to the record's own
  // creation date keeps deals that never got a "Дата - Запит" in the report
  // instead of silently dropping them.
  const cohortMonth =
    monthOf(requestedAt) ?? monthOf(createdAt ? createdAt.toISOString().slice(0, 10) : null);
  if (!cohortMonth) return null;

  return {
    recordId: r.recordId ?? r.id,
    name: str(f["Name"]),
    company: str(f["Компанія"]),
    stage: str(f["Воронка"]) ?? "Запит",
    clientType: str(f["Тип клієнта"]),
    budget: num(f["Бюджет"]),
    rawSource,
    source,
    channel: str(f["(Канал) How did they contact us?"]),
    lossReason: str(f["Причина програшу угоди"]),
    country: str(f["Country"]),
    technical: Boolean(f["Технічний"]),
    requestedAt,
    wonAt,
    lostAt,
    createdAt,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
    cohortMonth,
    closeMonth: monthOf(wonAt ?? lostAt),
    syncedAt: new Date(),
  };
}

function mapLead(r: NetHuntRecord, unknown: Set<string>) {
  const f = r.fields;
  const rawSource = str(f["Джерело"]);
  const { source, isOutbound, unknown: isUnknown } = normaliseSource(rawSource);
  if (isOutbound) return null;
  if (isUnknown && rawSource) unknown.add(rawSource);

  const leadDate = day(f["Дата створення"]) ?? day(r.createdAt);
  const month = monthOf(leadDate);
  if (!month) return null;

  const created = r.createdAt ? new Date(r.createdAt) : null;
  const updated = r.updatedAt ? new Date(r.updatedAt) : null;
  const stage = str(f["Воронка"]);

  // Proxy only: NetHunt has no "handed to sales" timestamp yet, so this is the
  // gap between the card appearing and its last edit. Untouched ("Новий") leads
  // and anything over 90 days are excluded so outliers don't move the average.
  let handlingHours: number | null = null;
  if (created && updated && stage && stage !== "Новий") {
    const h = (updated.getTime() - created.getTime()) / 3_600_000;
    if (h >= 0 && h < 24 * 90) handlingHours = h;
  }

  return {
    recordId: r.recordId ?? r.id,
    contactName: str(f["Ім'я"]) ?? str(f["Name"]),
    stage,
    qualification: str(f["Квал."]),
    channel: str(f["Канал (як зв'язались)"]) ?? "Не вказано",
    rawSource,
    source,
    utmSource: str(f["utm_source"]),
    utmMedium: str(f["utm_medium"]),
    utmCampaign: str(f["utm_campaign"]),
    leadDate,
    createdAt: created,
    updatedAt: updated,
    month,
    handlingHours,
    syncedAt: new Date(),
  };
}

async function lastSuccessfulSync(): Promise<Date | null> {
  const [row] = await db
    .select({ finishedAt: syncLog.finishedAt })
    .from(syncLog)
    .where(eq(syncLog.status, "ok"))
    .orderBy(desc(syncLog.startedAt))
    .limit(1);
  return row?.finishedAt ?? null;
}

/**
 * Pulls NetHunt into Postgres.
 *
 * First run (or `full: true`) walks the whole folder from 2024. Later runs only
 * ask for records changed since the last successful sync, with a 6-hour overlap
 * so a record edited mid-run isn't missed.
 */
export async function runSync(opts: { trigger: "manual" | "cron"; full?: boolean }): Promise<SyncResult> {
  const id = randomUUID();
  await db.insert(syncLog).values({ id, status: "running", trigger: opts.trigger });

  try {
    const last = opts.full ? null : await lastSuccessfulSync();
    const since = last ? new Date(last.getTime() - 6 * 3_600_000) : new Date("2024-01-01T00:00:00.000Z");
    const fetcher = last ? fetchUpdatedRecords : fetchNewRecords;

    const [dealRecords, leadRecords] = await Promise.all([
      fetcher(DEALS_FOLDER(), since),
      fetcher(LEADS_FOLDER(), since),
    ]);

    const unknown = new Set<string>();
    let skippedOutbound = 0;

    const dealRows = dealRecords
      .filter((r) => !r.deleted)
      .map((r) => {
        const row = mapDeal(r, unknown);
        if (!row) skippedOutbound++;
        return row;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const leadRows = leadRecords
      .filter((r) => !r.deleted)
      .map((r) => mapLead(r, unknown))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    for (const chunk of chunks(dealRows, 200)) {
      await db
        .insert(deals)
        .values(chunk)
        .onConflictDoUpdate({ target: deals.recordId, set: rest(deals, "recordId") as never });
    }
    for (const chunk of chunks(leadRows, 200)) {
      await db
        .insert(leads)
        .values(chunk)
        .onConflictDoUpdate({ target: leads.recordId, set: rest(leads, "recordId") as never });
    }

    const result: SyncResult = {
      dealsUpserted: dealRows.length,
      leadsUpserted: leadRows.length,
      unknownSources: [...unknown],
      skippedOutbound,
    };

    await db
      .update(syncLog)
      .set({
        status: "ok",
        finishedAt: new Date(),
        dealsUpserted: result.dealsUpserted,
        leadsUpserted: result.leadsUpserted,
        unknownSources: JSON.stringify(result.unknownSources),
      })
      .where(eq(syncLog.id, id));

    return result;
  } catch (e) {
    await db
      .update(syncLog)
      .set({ status: "error", finishedAt: new Date(), error: String(e) })
      .where(eq(syncLog.id, id));
    throw e;
  }
}

function* chunks<T>(arr: T[], size: number) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

/**
 * Builds the "overwrite every column except the primary key" SET clause for an
 * upsert, reading the incoming values from Postgres' `excluded` pseudo-table.
 */
function rest<T extends object>(table: T, skip: Extract<keyof T, string>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(table)) {
    const name = (col as { name?: string } | null)?.name;
    if (!name || key === skip) continue;
    set[key] = sql.raw(`excluded."${name}"`);
  }
  return set;
}
