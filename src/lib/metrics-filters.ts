/**
 * Analytics is deliberately scoped to the 2026 reporting year. Keeping the
 * parsing in one pure module gives every API consumer the same exact
 * month/source semantics instead of relying on client-side range math.
 */
export const ANALYTICS_YEAR_START = "2026-01";
export const ANALYTICS_YEAR_END = "2026-12";

export type MetricsFilters = {
  from: string;
  to: string;
  /** One normalised CRM source. Omitted means all sources. */
  source?: string;
};

export class MetricsFilterError extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentReportingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const number = parts.find((part) => part.type === "month")?.value;
  const month = year && number ? `${year}-${number}` : now.toISOString().slice(0, 7);
  if (month < ANALYTICS_YEAR_START) return ANALYTICS_YEAR_START;
  if (month > ANALYTICS_YEAR_END) return ANALYTICS_YEAR_END;
  return month;
}

function single(params: URLSearchParams, name: string) {
  const values = params.getAll(name);
  if (values.length > 1) {
    throw new MetricsFilterError(`Параметр ${name} можна вказати лише один раз.`);
  }
  return values[0] ?? null;
}

function readMonth(params: URLSearchParams, name: string) {
  const value = single(params, name);
  if (value === null) return null;
  if (!MONTH.test(value)) {
    throw new MetricsFilterError(`Параметр ${name} має формат РРРР-ММ.`);
  }
  return value;
}

/**
 * Parses /api/metrics filters.
 *
 * `month` is an exact month filter and therefore overrides a supplied range.
 * A range is clamped to 2026 so a query can never expose prior-year records.
 */
export function parseMetricsFilters(params: URLSearchParams, now = new Date()): MetricsFilters {
  const month = readMonth(params, "month");
  const sourceParam = single(params, "source");
  const source = sourceParam?.trim() || undefined;

  if (month) {
    if (month < ANALYTICS_YEAR_START || month > ANALYTICS_YEAR_END) {
      throw new MetricsFilterError("Доступні лише дані за 2026 рік.");
    }
    return { from: month, to: month, ...(source ? { source } : {}) };
  }

  const requestedFrom = readMonth(params, "from") ?? ANALYTICS_YEAR_START;
  const requestedTo = readMonth(params, "to") ?? currentReportingMonth(now);
  const from = requestedFrom < ANALYTICS_YEAR_START ? ANALYTICS_YEAR_START : requestedFrom;
  const to = requestedTo > ANALYTICS_YEAR_END ? ANALYTICS_YEAR_END : requestedTo;

  if (from > to) {
    throw new MetricsFilterError("Обраний період не містить даних за 2026 рік.");
  }

  return { from, to, ...(source ? { source } : {}) };
}
