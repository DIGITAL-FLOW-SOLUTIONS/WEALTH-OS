import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalIncome: numeric("total_income", { precision: 15, scale: 2 }).notNull().default("0"),
  totalExpenses: numeric("total_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  totalSavings: numeric("total_savings", { precision: 15, scale: 2 }).notNull().default("0"),
  totalInvestments: numeric("total_investments", { precision: 15, scale: 2 }).notNull().default("0"),
  netWorth: numeric("net_worth", { precision: 15, scale: 2 }).notNull().default("0"),
  healthScore: numeric("health_score", { precision: 5, scale: 1 }).notNull().default("0"),
  topExpenseCategory: text("top_expense_category").notNull().default(""),
  insights: text("insights"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
