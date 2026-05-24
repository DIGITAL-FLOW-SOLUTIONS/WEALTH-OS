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
} from "@workspace/api-zod";

const router: IRouter = Router();

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
