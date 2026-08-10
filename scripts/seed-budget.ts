/**
 * Loads marketing spend and Meta delivery metrics from data/budget-2026.json.
 * Idempotent — safe to re-run after editing the file.
 *
 *   npx tsx scripts/seed-budget.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { budget, metaStats } from "../src/db/schema";

async function main() {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data/budget-2026.json"), "utf8"));

  await db
    .insert(budget)
    .values(raw.budget)
    .onConflictDoUpdate({
      target: [budget.month, budget.channel],
      set: {
        amountUah: sql.raw('excluded."amount_uah"'),
        amountUsd: sql.raw('excluded."amount_usd"'),
        fxRate: sql.raw('excluded."fx_rate"'),
      },
    });

  await db
    .insert(metaStats)
    .values(raw.meta)
    .onConflictDoUpdate({
      target: metaStats.month,
      set: {
        spendUsd: sql.raw('excluded."spend_usd"'),
        impressions: sql.raw('excluded."impressions"'),
        reach: sql.raw('excluded."reach"'),
        clicks: sql.raw('excluded."clicks"'),
        conversations: sql.raw('excluded."conversations"'),
      },
    });

  console.log(`seeded ${raw.budget.length} budget rows, ${raw.meta.length} meta rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
