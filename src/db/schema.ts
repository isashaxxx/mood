import {
  pgTable, text, integer, doublePrecision, boolean, timestamp, date, index, primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Deals — mirror of the NetHunt "Inbound угоди" saved view. Its source folder
 * is "Всі угоди", but the full view filter is reproduced at sync time.
 *
 * cohortMonth is a legacy column name. It stores the Created month because
 * NetHunt's Inbound view is filtered by Created; closing can happen later.
 */
export const deals = pgTable(
  "deals",
  {
    recordId: text("record_id").primaryKey(),
    name: text("name"),
    company: text("company"),
    stage: text("stage").notNull(), // Воронка
    clientType: text("client_type"), // Новий клієнт / Існуючий клієнт
    budget: doublePrecision("budget").default(0).notNull(),
    rawSource: text("raw_source"), // as stored in CRM
    source: text("source").notNull(), // normalised, see taxonomy.ts
    channel: text("channel"), // (Канал) How did they contact us?
    lossReason: text("loss_reason"),
    country: text("country"),
    technical: boolean("technical").default(false).notNull(),
    requestedAt: date("requested_at"), // Дата - Запит
    wonAt: date("won_at"),
    lostAt: date("lost_at"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    cohortMonth: text("cohort_month").notNull(), // 'YYYY-MM' from createdAt
    closeMonth: text("close_month"), // 'YYYY-MM' from wonAt ?? lostAt
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    cohortIdx: index("deals_cohort_idx").on(t.cohortMonth),
    sourceIdx: index("deals_source_idx").on(t.source),
    stageIdx: index("deals_stage_idx").on(t.stage),
  })
);

/** Leads — mirror of the NetHunt "Ліди" folder. */
export const leads = pgTable(
  "leads",
  {
    recordId: text("record_id").primaryKey(),
    contactName: text("contact_name"),
    stage: text("stage"), // Воронка
    qualification: text("qualification"), // NQL / IQL / MQL / SQL
    channel: text("channel"), // Канал (як зв'язались)
    rawSource: text("raw_source"),
    source: text("source").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    leadDate: date("lead_date"), // Дата створення (business date)
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    month: text("month").notNull(), // 'YYYY-MM'
    /** Hours between record creation and the last card change. Proxy for
     *  handling time until NetHunt gets a real "handed to sales" timestamp. */
    handlingHours: doublePrecision("handling_hours"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    monthIdx: index("leads_month_idx").on(t.month),
    channelIdx: index("leads_channel_idx").on(t.channel),
  })
);

/** Monthly marketing spend, entered by hand or imported from the budget sheet. */
export const budget = pgTable(
  "budget",
  {
    month: text("month").notNull(), // 'YYYY-MM'
    channel: text("channel").notNull(), // meta | google_ads | seo | specialist
    amountUah: doublePrecision("amount_uah").default(0).notNull(),
    amountUsd: doublePrecision("amount_usd"),
    fxRate: doublePrecision("fx_rate"), // НБУ rate used for the conversion
    note: text("note"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.month, t.channel] }) })
);

/** Meta Ads monthly delivery metrics. */
export const metaStats = pgTable("meta_stats", {
  month: text("month").primaryKey(),
  spendUsd: doublePrecision("spend_usd").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  reach: integer("reach").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  conversations: integer("conversations").default(0).notNull(),
});

/** One row per sync run — powers the "Оновлено …" stamp and the refresh button. */
export const syncLog = pgTable("sync_log", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(), // running | ok | error
  dealsUpserted: integer("deals_upserted").default(0).notNull(),
  leadsUpserted: integer("leads_upserted").default(0).notNull(),
  unknownSources: text("unknown_sources"), // JSON array of values missing from the taxonomy
  error: text("error"),
  trigger: text("trigger"), // manual | cron
});

/**
 * Browser sessions are opaque, random tokens. Only a SHA-256 hash is stored,
 * so a database read cannot be used to impersonate an authenticated user.
 */
export const appSessions = pgTable(
  "app_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    user: text("user").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ expiresIdx: index("app_sessions_expires_idx").on(t.expiresAt) })
);
