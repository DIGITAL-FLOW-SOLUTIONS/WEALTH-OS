import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savingsTable = pgTable("savings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  account: text("account").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavingsSchema = createInsertSchema(savingsTable).omit({ id: true, createdAt: true, userId: true });
export type InsertSavings = z.infer<typeof insertSavingsSchema>;
export type Savings = typeof savingsTable.$inferSelect;
