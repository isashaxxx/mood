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

  // Access via globalThis keeps Next.js from replacing server secrets with
  // build-time values. Vercel Storage injects them only at function runtime.
  const runtimeEnv = (globalThis as typeof globalThis & { process: NodeJS.Process }).process.env;
  const env = (key: string): string | undefined => Reflect.get(runtimeEnv, key) as string | undefined;
  const url =
    env("DATABASE_URL") ??
    env("STORAGE_URL") ??
    // Vercel's Supabase integration exposes Postgres under these standard names.
    env("POSTGRES_URL") ??
    env("POSTGRES_PRISMA_URL") ??
    env("POSTGRES_URL_NON_POOLING") ??
    env("DATABASE_URL_DATABASE_URL") ??
    // Vercel's Neon integration prefixes its generated connection variables
    // with the integration name. Keep the generic names first, then support
    // the generated pooled and non-pooled URLs.
    env("DATABASE_URL_POSTGRES_URL") ??
    env("DATABASE_URL_POSTGRES_URL_NON_POOLING") ??
    env("DATABASE_URL_UNPOOLED");
  if (!url) {
    const checked = [
      "DATABASE_URL", "STORAGE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING", "DATABASE_URL_DATABASE_URL",
      "DATABASE_URL_POSTGRES_URL", "DATABASE_URL_POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED",
    ];
    console.error("Database environment availability", Object.fromEntries(checked.map((key) => [key, Boolean(env(key))] )));
    throw new Error("No configured Postgres database URL was found");
  }

  const client = postgres(url, { max: 1, prepare: false });
  database = drizzle(client, { schema });
  return database;
}

export { schema };
