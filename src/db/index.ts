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

  const url =
    process.env.DATABASE_URL ??
    process.env.STORAGE_URL ??
    process.env.DATABASE_URL_DATABASE_URL;
  if (!url) throw new Error("No configured Neon database URL was found");

  const client = postgres(url, { max: 1, prepare: false });
  database = drizzle(client, { schema });
  return database;
}

export { schema };
