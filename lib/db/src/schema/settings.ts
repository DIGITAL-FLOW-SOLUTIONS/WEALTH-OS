import { pgTable, text, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  currency: text("currency").notNull().default("KES"),
  theme: text("theme").notNull().default("dark"),
  emergencyFundMonths: numeric("emergency_fund_months", { precision: 5, scale: 1 }).notNull().default("6"),
  usdConversionRate: numeric("usd_conversion_rate", { precision: 10, scale: 4 }).notNull().default("130.0000"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, userId: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
