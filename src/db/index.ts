import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
if (!url) throw new Error("DATABASE_URL or STORAGE_URL is not set");

// One connection per lambda; Neon/Supabase poolers cap concurrency hard.
const client = postgres(url, { max: 1, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
