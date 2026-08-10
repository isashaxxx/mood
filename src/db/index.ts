import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Initialise only when a request actually needs the database. Route modules are
 * evaluated during Next.js builds, where deployment secrets may not exist yet.
 */
export function getDb() {
  if (database) return database;

  // Bracket access keeps server variables dynamic. Vercel Storage adds these
  // values only when the function starts, not while Next.js builds the app.
  const env = (key: string): string | undefined => process.env[key];
  const url =
    env("DATABASE_URL") ??
    env("STORAGE_URL") ??
    env("POSTGRES_URL") ??
    env("POSTGRES_PRISMA_URL") ??
    env("POSTGRES_URL_NON_POOLING") ??
    env("DATABASE_URL_DATABASE_URL") ??
    env("DATABASE_URL_POSTGRES_URL") ??
    env("DATABASE_URL_POSTGRES_URL_NON_POOLING") ??
    env("DATABASE_URL_UNPOOLED");

  if (!url) {
    throw new Error("No configured Postgres database URL was found");
  }

  const client = postgres(url, { max: 1, prepare: false });
  database = drizzle(client, { schema });
  return database;
}

export { schema };
