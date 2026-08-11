import { randomUUID } from "crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
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
/** Multi-select NetHunt fields (channels, tags, reasons) arrive as arrays.
 * Keep every value here: checking only the first tag could accidentally let an
 * outbound record into the inbound view. */
const strings = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(strings);
  const item = String(value).trim();
  return item ? [item] : [];
};
const has = (values: string[], expected: string) =>
  values.some((value) => value.localeCompare(expected, "uk", { sensitivity: "accent" }) === 0);
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
/** NetHunt resolves its relative Created filter in the workspace timezone. */
const monthInKyiv = (date: Date): string | null => {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
};
const REPORTING_YEAR = "2026";

export type SyncResult = {
  dealsUpserted: number;
  leadsUpserted: number;
  unknownSources: string[];
  skippedOutsideInbound: number;
};

/**
 * Reproduces the saved NetHunt view "Inbound угоди".
 *
 * The view itself is "Created this month". We retain all 2026 records that
 * meet its other conditions and group them by their Created month below, so
 * changing a month in the dashboard is exactly equivalent to changing the
 * NetHunt view's relative Created filter to that month.
 */
function isInboundDeal(f: Record<string, unknown>): boolean {
  const channel = strings(f["(Канал) How did they contact us?"]);
  const source = strings(f["(Джерело) Where do they know us from?"] ?? f["Джерело"]);
  const reason = strings(f["Привід"]);
  const tags = strings(f["Теги"]);

  return (
    source.length > 0 &&
    !has(channel, "Outbound sales") &&
    !has(channel, "Outbound leadgen") &&
    !has(source, "Outbound") &&
    !has(source, "Аутбаунд") &&
    !has(reason, "Супутні Витрати") &&
    !has(tags, "Marketing PL")
  );
}

function mapDeal(r: NetHuntRecord, unknown: Set<string>) {
  const f = r.fields;
  if (!isInboundDeal(f)) return null;

  const rawSource = str(f["(Джерело) Where do they know us from?"] ?? f["Джерело"]);
  const { source, isOutbound, unknown: isUnknown } = normaliseSource(rawSource);
  if (isOutbound) return null; // outbound never enters marketing reporting
  if (isUnknown && rawSource) unknown.add(rawSource);

  const requestedAt = day(f["Дата - Запит"]);
  const createdAt = r.createdAt ? new Date(r.createdAt) : null;
  const createdMonth = createdAt ? monthInKyiv(createdAt) : null;
  if (!createdMonth || !createdMonth.startsWith(`${REPORTING_YEAR}-`)) return null;
  const wonAt = day(f["Дата - Виграні"]);
  const lostAt = day(f["Дата - Програні"]);

  // The database column keeps its legacy name, but from this point it is the
  // reporting month of the NetHunt saved view: Created, not Date - Request.
  const cohortMonth = createdMonth;

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
  const db = getDb();
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
 * A full run rebuilds the 2026 deal mirror from the exact "Inbound угоди"
 * scope. Incremental runs only ask for records changed since the last
 * successful sync, with a 6-hour overlap so a record edited mid-run isn't
 * missed.
 */
export async function runSync(opts: { trigger: "manual" | "cron"; full?: boolean }): Promise<SyncResult> {
  const db = getDb();
  const id = randomUUID();
  await db.insert(syncLog).values({ id, status: "running", trigger: opts.trigger });

  try {
    const last = opts.full ? null : await lastSuccessfulSync();
    const since = last
      ? new Date(last.getTime() - 6 * 3_600_000)
      : new Date(`${REPORTING_YEAR}-01-01T00:00:00.000Z`);
    const fetcher = last ? fetchUpdatedRecords : fetchNewRecords;

    const [dealRecords, leadRecords] = await Promise.all([
      fetcher(DEALS_FOLDER(), since),
      fetcher(LEADS_FOLDER(), since),
    ]);
    if (opts.full && dealRecords.length === 0) {
      throw new Error("NetHunt returned no deal records; the existing mirror was left unchanged.");
    }

    const unknown = new Set<string>();
    let skippedOutsideInbound = 0;

    const excludedDealIds = new Set<string>();
    const dealRows = dealRecords.flatMap((record) => {
      const recordId = record.recordId ?? record.id;
      if (record.deleted) {
        excludedDealIds.add(recordId);
        return [];
      }
      const row = mapDeal(record, unknown);
      if (!row) {
        skippedOutsideInbound++;
        excludedDealIds.add(recordId);
        return [];
      }
      return [row];
    });

    const leadRows = leadRecords
      .filter((r) => !r.deleted)
      .map((r) => mapLead(r, unknown))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (opts.full) {
      // Never leave the old broad-folder rows in place: they are precisely what
      // caused the dashboard to show 240 records instead of the view's 104.
      await db.transaction(async (tx) => {
        await tx.delete(deals);
        for (const chunk of chunks(dealRows, 200)) {
          await tx
            .insert(deals)
            .values(chunk)
            .onConflictDoUpdate({ target: deals.recordId, set: rest(deals, "recordId") as never });
        }
      });
    } else {
      // A record can leave the view when someone changes its source, tag or
      // reason. Remove it from the local mirror instead of keeping stale data.
      for (const chunk of chunks([...excludedDealIds], 200)) {
        await db.delete(deals).where(inArray(deals.recordId, chunk));
      }
      for (const chunk of chunks(dealRows, 200)) {
        await db
          .insert(deals)
          .values(chunk)
          .onConflictDoUpdate({ target: deals.recordId, set: rest(deals, "recordId") as never });
      }
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
      skippedOutsideInbound,
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
