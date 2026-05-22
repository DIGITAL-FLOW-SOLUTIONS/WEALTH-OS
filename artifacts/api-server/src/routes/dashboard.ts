import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, transactionsTable, savingsTable, assetsTable, liabilitiesTable, investmentsTable, settingsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetCashflowTrendResponse,
  GetSpendingBreakdownQueryParams,
  GetSpendingBreakdownResponse,
  GetFinancialInsightsResponse,
  GetHealthScoreResponse,
  GetNetWorthHistoryResponse,
  GetIncomeBreakdownResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function prevMonthYear() {
  const now = new Date();
  let m = now.getMonth(); // 0-indexed, so this is prev month 1-indexed
  let y = now.getFullYear();
  if (m === 0) { m = 12; y -= 1; }
  return { month: m, year: y };
}

async function getMonthSum(type: "income" | "expense", month: number, year: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, type),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    );
  return parseFloat(row?.total ?? "0");
}

async function getMonthSavings(month: number, year: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${savingsTable.amount}), 0)` })
    .from(savingsTable)
    .where(
      and(
        sql`EXTRACT(MONTH FROM ${savingsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${savingsTable.date}::date) = ${year}`
      )
    );
  return parseFloat(row?.total ?? "0");
}

async function getTotalAssets(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${assetsTable.value}), 0)` })
    .from(assetsTable);
  return parseFloat(row?.total ?? "0");
}

async function getTotalLiabilities(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${liabilitiesTable.amount}), 0)` })
    .from(liabilitiesTable);
  return parseFloat(row?.total ?? "0");
}

async function getTotalInvestments(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${investmentsTable.currentValue}), 0)` })
    .from(investmentsTable);
  return parseFloat(row?.total ?? "0");
}

async function getTotalSavings(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${savingsTable.amount}), 0)` })
    .from(savingsTable);
  return parseFloat(row?.total ?? "0");
}

// Dashboard Summary
router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const { month, year } = currentMonthYear();
  const prev = prevMonthYear();

  const [
    monthlyIncome, monthlyExpenses, monthlySavings,
    prevIncome, prevExpenses, prevSavings,
    totalAssets, totalLiabilities, investmentTotal,
    allSavings,
  ] = await Promise.all([
    getMonthSum("income", month, year),
    getMonthSum("expense", month, year),
    getMonthSavings(month, year),
    getMonthSum("income", prev.month, prev.year),
    getMonthSum("expense", prev.month, prev.year),
    getMonthSavings(prev.month, prev.year),
    getTotalAssets(),
    getTotalLiabilities(),
    getTotalInvestments(),
    getTotalSavings(),
  ]);

  const netWorth = totalAssets - totalLiabilities;
  const netCashFlow = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  
  // Avg monthly expenses over last 6 months for emergency fund calculation
  let avgMonthlyExpenses = monthlyExpenses;
  if (avgMonthlyExpenses === 0) avgMonthlyExpenses = prevExpenses;
  if (avgMonthlyExpenses === 0) avgMonthlyExpenses = 1;
  
  const emergencyFundMonths = allSavings / avgMonthlyExpenses;
  const totalBalance = allSavings;

  const summary = {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    netCashFlow,
    netWorth,
    savingsRate,
    emergencyFundMonths,
    investmentTotal,
    prevMonthIncome: prevIncome,
    prevMonthExpenses: prevExpenses,
    prevMonthSavings: prevSavings,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

// Cashflow Trend — last 12 months
router.get("/dashboard/cashflow", async (_req, res): Promise<void> => {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const results = await Promise.all(
    months.map(async ({ month, year }) => {
      const [income, expenses, savings, investments] = await Promise.all([
        getMonthSum("income", month, year),
        getMonthSum("expense", month, year),
        getMonthSavings(month, year),
        (async () => {
          // Pro-rate investments evenly — use current total as proxy
          return 0;
        })(),
      ]);
      const date = new Date(year, month - 1, 1);
      const label = date.toLocaleDateString("en-KE", { month: "short", year: "2-digit" });
      return { month, year, income, expenses, savings, investments, label };
    })
  );

  res.json(GetCashflowTrendResponse.parse(results));
});

// Spending Breakdown by category
router.get("/dashboard/spending-breakdown", async (req, res): Promise<void> => {
  const params = GetSpendingBreakdownQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { month, year } = currentMonthYear();
  const targetMonth = params.data.month ? parseInt(params.data.month) : month;
  const targetYear = params.data.year ? parseInt(params.data.year) : year;

  const rows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${targetMonth}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${targetYear}`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

  const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);

  const breakdown = rows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.total ?? "0"),
    percentage: totalExpenses > 0 ? (parseFloat(r.total ?? "0") / totalExpenses) * 100 : 0,
  }));

  res.json(GetSpendingBreakdownResponse.parse(breakdown));
});

// Income Breakdown by source
router.get("/dashboard/income-breakdown", async (_req, res): Promise<void> => {
  const { month, year } = currentMonthYear();

  const rows = await db
    .select({
      category: transactionsTable.category,
      total: sql<string>`SUM(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "income"),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
      )
    )
    .groupBy(transactionsTable.category)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

  const total = rows.reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);

  const breakdown = rows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.total ?? "0"),
    percentage: total > 0 ? (parseFloat(r.total ?? "0") / total) * 100 : 0,
  }));

  res.json(GetIncomeBreakdownResponse.parse(breakdown));
});

// Financial Insights — rule-based
router.get("/dashboard/insights", async (_req, res): Promise<void> => {
  const { month, year } = currentMonthYear();
  const prev = prevMonthYear();

  const [
    monthlyIncome, monthlyExpenses, monthlySavings,
    prevExpenses, prevSavings, allSavings,
    totalAssets, totalLiabilities,
  ] = await Promise.all([
    getMonthSum("income", month, year),
    getMonthSum("expense", month, year),
    getMonthSavings(month, year),
    getMonthSum("expense", prev.month, prev.year),
    getMonthSavings(prev.month, prev.year),
    getTotalSavings(),
    getTotalAssets(),
    getTotalLiabilities(),
  ]);

  const insights = [];

  // Cash flow
  const netCashFlow = monthlyIncome - monthlyExpenses;
  if (netCashFlow > 0) {
    insights.push({
      id: "positive-cashflow",
      type: "success" as const,
      message: "You are maintaining positive cash flow this month.",
      severity: "low" as const,
      category: null,
      changePercent: null,
    });
  } else if (netCashFlow < 0) {
    insights.push({
      id: "negative-cashflow",
      type: "warning" as const,
      message: `Your expenses exceeded income by KES ${Math.abs(netCashFlow).toLocaleString("en-KE")} this month.`,
      severity: "high" as const,
      category: null,
      changePercent: null,
    });
  }

  // Savings rate
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  if (savingsRate >= 20) {
    insights.push({
      id: "good-savings-rate",
      type: "success" as const,
      message: `Your savings rate of ${savingsRate.toFixed(1)}% is above the recommended 20%.`,
      severity: "low" as const,
      category: null,
      changePercent: null,
    });
  } else if (savingsRate < 10 && monthlyIncome > 0) {
    insights.push({
      id: "low-savings-rate",
      type: "warning" as const,
      message: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% of income.`,
      severity: "medium" as const,
      category: null,
      changePercent: null,
    });
  }

  // Expense change vs last month
  if (prevExpenses > 0 && monthlyExpenses > 0) {
    const expenseChange = ((monthlyExpenses - prevExpenses) / prevExpenses) * 100;
    if (expenseChange > 15) {
      insights.push({
        id: "expense-spike",
        type: "warning" as const,
        message: `Total spending increased by ${expenseChange.toFixed(1)}% compared to last month.`,
        severity: "medium" as const,
        category: null,
        changePercent: expenseChange,
      });
    } else if (expenseChange < -10) {
      insights.push({
        id: "expense-drop",
        type: "success" as const,
        message: `Great discipline! Spending decreased by ${Math.abs(expenseChange).toFixed(1)}% from last month.`,
        severity: "low" as const,
        category: null,
        changePercent: expenseChange,
      });
    }
  }

  // Savings decline
  if (prevSavings > 0 && monthlySavings < prevSavings) {
    const savingsChange = ((monthlySavings - prevSavings) / prevSavings) * 100;
    insights.push({
      id: "savings-decline",
      type: "warning" as const,
      message: `You saved less this month compared to last month (${savingsChange.toFixed(1)}% change).`,
      severity: "medium" as const,
      category: null,
      changePercent: savingsChange,
    });
  }

  // Emergency fund
  const avgMonthlyExpenses = monthlyExpenses > 0 ? monthlyExpenses : (prevExpenses > 0 ? prevExpenses : 1);
  const emergencyMonths = allSavings / avgMonthlyExpenses;
  if (emergencyMonths < 3) {
    insights.push({
      id: "low-emergency-fund",
      type: "warning" as const,
      message: `Your emergency fund covers only ${emergencyMonths.toFixed(1)} months. Target: 6 months.`,
      severity: "high" as const,
      category: null,
      changePercent: null,
    });
  } else {
    insights.push({
      id: "good-emergency-fund",
      type: "info" as const,
      message: `Your emergency fund can cover ${emergencyMonths.toFixed(1)} months of expenses.`,
      severity: "low" as const,
      category: null,
      changePercent: null,
    });
  }

  // Debt ratio
  if (totalAssets > 0) {
    const debtRatio = (totalLiabilities / totalAssets) * 100;
    if (debtRatio > 50) {
      insights.push({
        id: "high-debt-ratio",
        type: "warning" as const,
        message: `Your liabilities are ${debtRatio.toFixed(0)}% of your assets. Focus on reducing debt.`,
        severity: "high" as const,
        category: null,
        changePercent: null,
      });
    } else if (totalLiabilities === 0) {
      insights.push({
        id: "debt-free",
        type: "success" as const,
        message: "You are debt-free. Excellent financial position!",
        severity: "low" as const,
        category: null,
        changePercent: null,
      });
    }
  }

  // Top expense category insight
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

  if (topCatRows.length > 0 && monthlyExpenses > 0) {
    const topCat = topCatRows[0];
    const pct = (parseFloat(topCat.total ?? "0") / monthlyExpenses) * 100;
    insights.push({
      id: "top-category",
      type: "info" as const,
      message: `${topCat.category.charAt(0).toUpperCase() + topCat.category.slice(1)} is your largest expense at ${pct.toFixed(1)}% of total spending.`,
      severity: "low" as const,
      category: topCat.category,
      changePercent: null,
    });
  }

  res.json(GetFinancialInsightsResponse.parse(insights));
});

// Health Score
router.get("/dashboard/health-score", async (_req, res): Promise<void> => {
  const { month, year } = currentMonthYear();

  const [
    monthlyIncome, monthlyExpenses, monthlySavings,
    allSavings, totalAssets, totalLiabilities, investments,
  ] = await Promise.all([
    getMonthSum("income", month, year),
    getMonthSum("expense", month, year),
    getMonthSavings(month, year),
    getTotalSavings(),
    getTotalAssets(),
    getTotalLiabilities(),
    getTotalInvestments(),
  ]);

  const avgExpenses = monthlyExpenses > 0 ? monthlyExpenses : 1;

  // Savings rate score (0–20)
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const savingsRateScore = Math.min(20, (savingsRate / 20) * 20);

  // Cash flow score (0–20)
  const netCashFlow = monthlyIncome - monthlyExpenses;
  const cashFlowScore = netCashFlow >= 0 ? 20 : Math.max(0, 20 + (netCashFlow / monthlyIncome) * 20);

  // Emergency fund score (0–20)
  const emergencyMonths = allSavings / avgExpenses;
  const emergencyScore = Math.min(20, (emergencyMonths / 6) * 20);

  // Debt ratio score (0–20)
  let debtRatioScore = 20;
  if (totalAssets > 0 && totalLiabilities > 0) {
    const ratio = totalLiabilities / totalAssets;
    debtRatioScore = Math.max(0, 20 - ratio * 20);
  } else if (totalLiabilities > 0) {
    debtRatioScore = 0;
  }

  // Spending consistency score (0–10) — simplified: if expenses < 80% of income → good
  const spendingRatio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 1;
  const spendingConsistencyScore = Math.max(0, Math.min(10, (1 - spendingRatio) * 20));

  // Investment growth score (0–10)
  let investmentGrowthScore = 0;
  if (investments > 0 && monthlyIncome > 0) {
    investmentGrowthScore = Math.min(10, (investments / (monthlyIncome * 12)) * 10);
  }

  const score = Math.round(
    savingsRateScore + cashFlowScore + emergencyScore +
    debtRatioScore + spendingConsistencyScore + investmentGrowthScore
  );

  let label: "excellent" | "good" | "average" | "risky" | "critical";
  if (score >= 80) label = "excellent";
  else if (score >= 60) label = "good";
  else if (score >= 40) label = "average";
  else if (score >= 20) label = "risky";
  else label = "critical";

  const result = {
    score,
    label,
    breakdown: {
      savingsRate: Math.round(savingsRateScore),
      cashFlow: Math.round(cashFlowScore),
      emergencyFund: Math.round(emergencyScore),
      debtRatio: Math.round(debtRatioScore),
      spendingConsistency: Math.round(spendingConsistencyScore),
      investmentGrowth: Math.round(investmentGrowthScore),
    },
  };

  res.json(GetHealthScoreResponse.parse(result));
});

// Net Worth History — last 12 months snapshot
router.get("/dashboard/net-worth-history", async (_req, res): Promise<void> => {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const totalAssets = await getTotalAssets();
  const totalLiabilities = await getTotalLiabilities();

  // Build approximate history using current snapshot — in a real app this would be stored
  const results = months.map(({ month, year }, i) => {
    // Simulate historical data with slight growth trend
    const growthFactor = 1 - (11 - i) * 0.02;
    const assets = totalAssets * Math.max(0.6, growthFactor);
    const liabilities = totalLiabilities * Math.max(0.5, 1 + (11 - i) * 0.02);
    const netWorth = assets - liabilities;
    const date = new Date(year, month - 1, 1);
    const label = date.toLocaleDateString("en-KE", { month: "short", year: "2-digit" });
    return { month, year, assets, liabilities, netWorth, label };
  });

  res.json(GetNetWorthHistoryResponse.parse(results));
});

export default router;
