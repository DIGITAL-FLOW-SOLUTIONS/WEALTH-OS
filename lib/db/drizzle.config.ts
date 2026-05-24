import { defineConfig } from "drizzle-kit";
import path from "path";

const url =
  process.env.SUPABASE_POOLER_CONNECTION_STRING ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error("Database URL not configured. Set SUPABASE_POOLER_CONNECTION_STRING or DATABASE_URL.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});
