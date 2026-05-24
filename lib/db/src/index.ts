import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_POOLER_CONNECTION_STRING ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Database connection not configured. Set SUPABASE_POOLER_CONNECTION_STRING or DATABASE_URL.",
  );
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
