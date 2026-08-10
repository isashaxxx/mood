/**
 * Full pull from NetHunt. Use once after `db:push`, then let the cron take over.
 *
 *   npx tsx scripts/sync-cli.ts --full
 */
import { runSync } from "../src/lib/sync";

const full = process.argv.includes("--full");

runSync({ trigger: "manual", full })
  .then((r) => {
    console.log(`deals: ${r.dealsUpserted}, leads: ${r.leadsUpserted}, outbound skipped: ${r.skippedOutbound}`);
    if (r.unknownSources.length) console.warn("Джерела поза мапінгом:", r.unknownSources.join(", "));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
