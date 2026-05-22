import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, transactionsTable, savingsTable, assetsTable, liabilitiesTable, investmentsTable } from "@workspace/db";
import {
  ListReportsResponse,
  GetMonthlyReportParams,
  GetMonthlyReportResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildReport(month: number, year: number) {
  const [incomeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "income"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    );

  const [expenseRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    );

  const [savingsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${savingsTable.amount}), 0)` })
    .from(savingsTable)
    .where(
      and(
        sql`EXTRACT(MONTH FROM ${savingsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${savingsTable.date}::date) = ${year}`
      )
    );

  const [assetsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${assetsTable.value}), 0)` })
    .from(assetsTable);

  const [liabilitiesRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${liabilitiesTable.amount}), 0)` })
    .from(liabilitiesTable);

  const [investmentsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${investmentsTable.currentValue}), 0)` })
    .from(investmentsTable);

  const topCatRows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`)
    .limit(1);

  const totalIncome = parseFloat(incomeRow?.total ?? "0");
  const totalExpenses = parseFloat(expenseRow?.total ?? "0");
  const totalSavings = parseFloat(savingsRow?.total ?? "0");
  const totalAssets = parseFloat(assetsRow?.total ?? "0");
  const totalLiabilities = parseFloat(liabilitiesRow?.total ?? "0");
  const totalInvestments = parseFloat(investmentsRow?.total ?? "0");
  const netWorth = totalAssets - totalLiabilities;

  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
  const netCF = totalIncome - totalExpenses;
  const emergencyMonths = totalSavings / (totalExpenses > 0 ? totalExpenses : 1);
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 1;
  const scoreRaw =
    Math.min(20, (savingsRate / 20) * 20) +
    (netCF >= 0 ? 20 : Math.max(0, 20 + (netCF / (totalIncome || 1)) * 20)) +
    Math.min(20, (emergencyMonths / 6) * 20) +
    Math.max(0, 20 - debtRatio * 20) +
    Math.max(0, Math.min(10, (1 - (totalExpenses / (totalIncome || 1))) * 20)) +
    Math.min(10, totalInvestments > 0 ? 5 : 0);
  const healthScore = Math.round(scoreRaw);

  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });

  return {
    id: month + year * 100,
    month,
    year,
    totalIncome,
    totalExpenses,
    totalSavings,
    totalInvestments,
    netWorth,
    healthScore,
    topExpenseCategory: topCatRows[0]?.category ?? "none",
    insights: `Net cashflow: KES ${netCF.toLocaleString("en-KE")}. Savings rate: ${savingsRate.toFixed(1)}%.`,
    label,
    createdAt: new Date().toISOString(),
  };
}

router.get("/reports", async (_req, res): Promise<void> => {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const reports = await Promise.all(months.map(({ month, year }) => buildReport(month, year)));
  res.json(ListReportsResponse.parse(reports));
});

router.get("/reports/:year/:month", async (req, res): Promise<void> => {
  const params = GetMonthlyReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const report = await buildReport(params.data.month, params.data.year);
  res.json(GetMonthlyReportResponse.parse(report));
});

export default router;
