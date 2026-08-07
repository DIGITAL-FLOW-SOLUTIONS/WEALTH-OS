import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, budgetsTable, transactionsTable } from "@workspace/db";
import {
  ListBudgetsQueryParams,
  ListBudgetsResponse,
  CreateBudgetBody,
  UpdateBudgetParams,
  UpdateBudgetBody,
  UpdateBudgetResponse,
  DeleteBudgetParams,
  CreateBudgetDraftBody,
  CreateBudgetDraftResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function previousMonth(month: number, year: number, offset: number) {
  const date = new Date(year, month - 1 - offset, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

async function getBudgetWithSpent(budget: typeof budgetsTable.$inferSelect, userId: string) {
  const createdAt = budget.createdAt instanceof Date ? budget.createdAt.toISOString() as unknown as Date : budget.createdAt;
  const b = { ...budget, createdAt };

  const [spentRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        eq(transactionsTable.category, b.category),
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${b.month}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${b.year}`
      )
    );
  return {
    ...b,
    limit: parseFloat(b.limit as string),
    spent: parseFloat(spentRow?.total ?? "0"),
  };
}

router.get("/budgets", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = ListBudgetsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conditions = [eq(budgetsTable.userId, userId)];
  if (params.data.month) conditions.push(sql`${budgetsTable.month} = ${parseInt(params.data.month)}`);
  if (params.data.year) conditions.push(sql`${budgetsTable.year} = ${parseInt(params.data.year)}`);

  const rows = await db.select().from(budgetsTable).where(and(...conditions)).orderBy(budgetsTable.category);
  const withSpent = await Promise.all(rows.map((r) => getBudgetWithSpent(r, userId)));
  res.json(ListBudgetsResponse.parse(withSpent));
});

router.post("/budgets/draft", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateBudgetDraftBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { month, year, essentialCategories } = parsed.data;
  const lookback = [previousMonth(month, year, 1), previousMonth(month, year, 2)];
  const monthRows = await Promise.all(lookback.map(({ month: m, year: y }) =>
    db.select({
      category: transactionsTable.category,
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        sql`${transactionsTable.category} IN (${sql.join(essentialCategories.map((category) => sql`${category}`), sql`, `)})`,
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${m}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${y}`,
      ))
      .groupBy(transactionsTable.category)
  ));

  const incomeRows = await Promise.all(lookback.map(({ month: m, year: y }) =>
    db.select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        sql`${transactionsTable.category} NOT IN ('carry_forward', 'last_balance')`,
        sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${m}`,
        sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${y}`,
      ))
  ));

  const totals = new Map<string, number[]>();
  for (const category of essentialCategories) totals.set(category, [0, 0]);
  monthRows.forEach((rows, index) => {
    for (const row of rows) {
      const values = totals.get(row.category);
      if (values) values[index] = parseFloat(row.total ?? "0");
    }
  });

  const items = essentialCategories.map((category) => {
    const values = totals.get(category) ?? [0, 0];
    const averageSpent = (values[0] + values[1]) / 2;
    const latestSpent = values[0];
    const suggestedLimit = averageSpent > 0 ? Math.ceil((averageSpent * 1.05) / 50) * 50 : 0;
    const note = averageSpent === 0
      ? "No recent spend found — add a realistic amount if this is a new need."
      : latestSpent > averageSpent * 1.15
        ? "Last month ran higher than your two-month average. Keep a small buffer."
        : "Based on your two-month average with a 5% breathing room.";
    return { category, suggestedLimit, averageSpent, latestSpent, note };
  });

  const averageIncome = incomeRows.reduce((sum, rows) => sum + parseFloat(rows[0]?.total ?? "0"), 0) / 2;
  const essentialTotal = items.reduce((sum, item) => sum + item.suggestedLimit, 0);
  const available = Math.max(0, averageIncome - essentialTotal);
  const ideas = available >= 500 ? [
    {
      name: "Money Market Fund",
      type: "mmf",
      suggestedAmount: Math.max(500, Math.min(available * 0.15, 2500)),
      minimumAmount: 500,
      why: "A liquid, lower-volatility place to start building an emergency cushion while keeping access to your money.",
    },
    {
      name: "SACCO or goal-based savings",
      type: "savings",
      suggestedAmount: Math.max(500, Math.min(available * 0.1, 1500)),
      minimumAmount: 500,
      why: "A consistent small contribution can build discipline before taking on higher-risk investments.",
    },
  ] : [
    {
      name: "Starter savings buffer",
      type: "savings",
      suggestedAmount: 500,
      minimumAmount: 100,
      why: "Your essentials use most of the recent income average, so start with a small buffer before investing.",
    },
  ];

  res.json(CreateBudgetDraftResponse.parse({
    month,
    year,
    lookbackMonths: 2,
    averageIncome,
    essentialTotal,
    items,
    ideas,
    message: averageIncome > 0
      ? `Your essentials are covered first, leaving about KES ${Math.round(available).toLocaleString("en-KE")} for savings and wealth building.`
      : "Add income transactions for the last two months to make the wealth-building suggestions more precise.",
  }));
});

router.post("/budgets", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { limit, ...rest } = parsed.data;
  const [row] = await db.insert(budgetsTable).values({ ...rest, limit: String(limit), userId }).returning();
  const withSpent = await getBudgetWithSpent(row, userId);
  res.status(201).json(withSpent);
});

router.patch("/budgets/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateBudgetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { limit, ...rest } = parsed.data;
  const setData = { ...rest, ...(limit != null ? { limit: String(limit) } : {}) };
  const [row] = await db.update(budgetsTable).set(setData).where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Budget not found" }); return; }
  const withSpent = await getBudgetWithSpent(row, userId);
  res.json(UpdateBudgetResponse.parse(withSpent));
});

router.delete("/budgets/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteBudgetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(budgetsTable).where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Budget not found" }); return; }
  res.sendStatus(204);
});

export default router;
