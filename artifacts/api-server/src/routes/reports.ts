import { Router, type IRouter } from "express";
import { and, eq, sql, notInArray } from "drizzle-orm";
import { db, transactionsTable, savingsTable, assetsTable, liabilitiesTable, investmentsTable, goalsTable } from "@workspace/db";
import {
  ListReportsResponse,
  GetMonthlyReportParams,
  GetMonthlyReportResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CARRY_CATEGORIES = ["carry_forward", "last_balance"] as const;

async function getMonthOpeningBalance(userId: string, month: number, year: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        sql`${transactionsTable.category} IN (${sql.join(CARRY_CATEGORIES.map(c => sql`${c}`), sql`, `)})`,
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    );
  return parseFloat(row?.total ?? "0");
}

function parseTx(t: typeof transactionsTable.$inferSelect) {
  return {
    ...t,
    amount: parseFloat(t.amount as string),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

function parseSavings(s: typeof savingsTable.$inferSelect) {
  return {
    ...s,
    amount: parseFloat(s.amount as string),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

function parseGoal(g: typeof goalsTable.$inferSelect) {
  return {
    ...g,
    targetAmount: parseFloat(g.targetAmount as string),
    currentAmount: parseFloat(g.currentAmount as string),
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

async function buildReport(userId: string, month: number, year: number) {
  // ─── Core aggregations ───
  const [incomeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`,
        notInArray(transactionsTable.category, ["carry_forward", "last_balance"])
      )
    );

  const [expenseRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
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
        eq(savingsTable.userId, userId),
        sql`EXTRACT(MONTH FROM ${savingsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${savingsTable.date}::date) = ${year}`
      )
    );

  const [assetsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${assetsTable.value}), 0)` })
    .from(assetsTable)
    .where(eq(assetsTable.userId, userId));

  const [liabilitiesRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${liabilitiesTable.amount}), 0)` })
    .from(liabilitiesTable)
    .where(eq(liabilitiesTable.userId, userId));

  const [investmentsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${investmentsTable.currentValue}), 0)` })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, userId));

  const topCatRows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`)
    .limit(1);

  const openingBalance = await getMonthOpeningBalance(userId, month, year);

  // Carry Forward is an opening balance, not income earned during this month.
  // Keep it separate from Income; it is added to Net Cash Flow for cash available.
  const totalIncome = parseFloat(incomeRow?.total ?? "0");
  const totalExpenses = parseFloat(expenseRow?.total ?? "0");
  const totalSavings = parseFloat(savingsRow?.total ?? "0");
  const totalAssets = parseFloat(assetsRow?.total ?? "0");
  const totalLiabilities = parseFloat(liabilitiesRow?.total ?? "0");
  const totalInvestments = parseFloat(investmentsRow?.total ?? "0");
  const netWorth = totalAssets - totalLiabilities;

  // ─── Spending breakdown by category ───
  const spendingCatRows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

  const spendingBreakdown = spendingCatRows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.total ?? "0"),
    percentage: totalExpenses > 0 ? (parseFloat(r.total ?? "0") / totalExpenses) * 100 : 0,
  }));

  // ─── Income breakdown by category (excluding carry_forward) ───
  const incomeCatRows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`,
        sql`${transactionsTable.category} NOT IN (${sql.join(CARRY_CATEGORIES.map(c => sql`${c}`), sql`, `)})`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

  const incomeBreakdown = incomeCatRows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.total ?? "0"),
    percentage: totalIncome > 0 ? (parseFloat(r.total ?? "0") / totalIncome) * 100 : 0,
  }));

  // ─── Transactions for the month ───
  const incomeTransactions = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .orderBy(sql`${transactionsTable.date} DESC`);

  const expenseTransactions = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .orderBy(sql`${transactionsTable.date} DESC`);

  // ─── Savings records for the month ───
  const savingsRecords = await db
    .select()
    .from(savingsTable)
    .where(
      and(
        eq(savingsTable.userId, userId),
        sql`EXTRACT(MONTH FROM ${savingsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${savingsTable.date}::date) = ${year}`
      )
    )
    .orderBy(savingsTable.date);

  // ─── Goals created this month ───
  const goalsRecords = await db
    .select()
    .from(goalsTable)
    .where(
      and(
        eq(goalsTable.userId, userId),
        sql`EXTRACT(MONTH FROM ${goalsTable.createdAt}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${goalsTable.createdAt}::date) = ${year}`
      )
    )
    .orderBy(goalsTable.createdAt);

  // ─── Monthly insights (scoped to this month) ───
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [prevTxIncome, prevTotalExpenses, prevTotalSavings] = await Promise.all([
    (async () => {
      const [r] = await db.select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "income"),
            sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${prevMonth}`,
            sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${prevYear}`,
            notInArray(transactionsTable.category, ["carry_forward", "last_balance"])
          )
        );
      return parseFloat(r?.total ?? "0");
    })(),
    (async () => {
      const [r] = await db.select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "expense"),
            sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${prevMonth}`,
            sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${prevYear}`
          )
        );
      return parseFloat(r?.total ?? "0");
    })(),
    (async () => {
      const [r] = await db.select({ total: sql<string>`COALESCE(SUM(${savingsTable.amount}), 0)` })
        .from(savingsTable)
        .where(
          and(
            eq(savingsTable.userId, userId),
            sql`EXTRACT(MONTH FROM ${savingsTable.date}::date) = ${prevMonth}`,
            sql`EXTRACT(YEAR FROM ${savingsTable.date}::date) = ${prevYear}`
          )
        );
      return parseFloat(r?.total ?? "0");
    })(),
  ]);

  const monthlyInsights = [] as Array<{
    id: string;
    type: "warning" | "info" | "success" | "tip";
    message: string;
    severity: "low" | "medium" | "high";
    category: string | null;
    changePercent: number | null;
  }>;

  const operatingNetCF = totalIncome - totalExpenses;
  const netCF = operatingNetCF + openingBalance;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  if (operatingNetCF < 0) {
    monthlyInsights.push({ id: "negative-cashflow", type: "warning", message: `Your expenses exceeded income by KES ${Math.abs(operatingNetCF).toLocaleString("en-KE")} in ${new Date(year, month - 1, 1).toLocaleDateString("en-KE", { month: "long" })}.`, severity: "high", category: null, changePercent: null });
  }

  if (savingsRate >= 20) {
    monthlyInsights.push({ id: "good-savings-rate", type: "success", message: `Your savings rate of ${savingsRate.toFixed(1)}% is above the recommended 20%.`, severity: "low", category: null, changePercent: null });
  } else if (savingsRate < 10 && totalIncome > 0) {
    monthlyInsights.push({ id: "low-savings-rate", type: "warning", message: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% of income.`, severity: "medium", category: null, changePercent: null });
  }

  if (prevTotalExpenses > 0 && totalExpenses > 0) {
    const expenseChange = ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100;
    if (expenseChange > 15) {
      monthlyInsights.push({ id: "expense-spike", type: "warning", message: `Spending increased by ${expenseChange.toFixed(1)}% compared to the previous month.`, severity: "medium", category: null, changePercent: expenseChange });
    } else if (expenseChange < -10) {
      monthlyInsights.push({ id: "expense-drop", type: "success", message: `Great discipline! Spending decreased by ${Math.abs(expenseChange).toFixed(1)}% from last month.`, severity: "low", category: null, changePercent: expenseChange });
    }
  }

  if (prevTotalSavings > 0 && totalSavings < prevTotalSavings) {
    const savingsChange = ((totalSavings - prevTotalSavings) / prevTotalSavings) * 100;
    monthlyInsights.push({ id: "savings-decline", type: "warning", message: `You saved less this month compared to last month (${savingsChange.toFixed(1)}% change).`, severity: "medium", category: null, changePercent: savingsChange });
  }

  const efMonths = totalSavings / (totalExpenses > 0 ? totalExpenses : 1);
  if (efMonths < 3) {
    monthlyInsights.push({ id: "low-emergency-fund", type: "warning", message: `Emergency fund covers only ${efMonths.toFixed(1)} months. Target: 6 months.`, severity: "high", category: null, changePercent: null });
  } else {
    monthlyInsights.push({ id: "good-emergency-fund", type: "info", message: `Emergency fund can cover ${efMonths.toFixed(1)} months of expenses.`, severity: "low", category: null, changePercent: null });
  }

  if (totalAssets > 0) {
    const debtRatio = (totalLiabilities / totalAssets) * 100;
    if (debtRatio > 50) {
      monthlyInsights.push({ id: "high-debt-ratio", type: "warning", message: `Liabilities are ${debtRatio.toFixed(0)}% of assets. Focus on reducing debt.`, severity: "high", category: null, changePercent: null });
    } else if (totalLiabilities === 0) {
      monthlyInsights.push({ id: "debt-free", type: "success", message: "You are debt-free. Excellent financial position!", severity: "low", category: null, changePercent: null });
    }
  }

  if (topCatRows.length > 0) {
    const topCat = topCatRows[0];
    const pct = totalExpenses > 0 ? (parseFloat(topCat.total ?? "0") / totalExpenses) * 100 : 0;
    monthlyInsights.push({ id: "top-category", type: "info", message: `${topCat.category.charAt(0).toUpperCase() + topCat.category.slice(1)} is your largest expense at ${pct.toFixed(1)}% of total spending.`, severity: "low", category: topCat.category, changePercent: null });
  }

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
    openingBalance,
    spendingBreakdown,
    incomeBreakdown,
    incomeTransactions: incomeTransactions.map(parseTx),
    expenseTransactions: expenseTransactions.map(parseTx),
    savingsRecords: savingsRecords.map(parseSavings),
    goalsRecords: goalsRecords.map(parseGoal),
    monthlyInsights,
  };
}

router.get("/reports", async (req, res): Promise<void> => {
  const userId = req.userId;
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const reports = await Promise.all(months.map(({ month, year }) => buildReport(userId, month, year)));
  res.json(ListReportsResponse.parse(reports));
});

router.get("/reports/:year/:month", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = GetMonthlyReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.success ? "" : params.error.message });
    return;
  }
  const report = await buildReport(userId, params.data.month, params.data.year);
  res.json(GetMonthlyReportResponse.parse(report));
});

export default router;
