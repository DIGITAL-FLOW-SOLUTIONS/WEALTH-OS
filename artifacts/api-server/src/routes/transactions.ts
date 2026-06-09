import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  CreateTransactionBody,
  GetTransactionParams,
  GetTransactionResponse,
  UpdateTransactionParams,
  UpdateTransactionBody,
  UpdateTransactionResponse,
  DeleteTransactionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseTransaction(t: typeof transactionsTable.$inferSelect) {
  return {
    ...t,
    amount: parseFloat(t.amount as string),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

router.get("/transactions", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = ListTransactionsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conditions = [eq(transactionsTable.userId, userId)];
  if (params.data.type) conditions.push(eq(transactionsTable.type, params.data.type));
  if (params.data.category) conditions.push(eq(transactionsTable.category, params.data.category));
  if (params.data.month && params.data.year) {
    const m = params.data.month.padStart(2, "0");
    conditions.push(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${`${params.data.year}-${m}`}`);
  } else if (params.data.year) {
    conditions.push(sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${parseInt(params.data.year)}`);
  }

  const rows = await db.select().from(transactionsTable).where(and(...conditions)).orderBy(sql`${transactionsTable.date} DESC`);
  res.json(ListTransactionsResponse.parse(rows.map(parseTransaction)));
});

router.post("/transactions", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, ...rest } = parsed.data;
  const [row] = await db.insert(transactionsTable).values({ ...rest, amount: String(amount), userId }).returning();
  res.status(201).json(GetTransactionResponse.parse(parseTransaction(row)));
});

router.post("/transactions/carry-forward", async (req, res): Promise<void> => {
  const userId = req.userId;
  const now = new Date();
  const targetMonth = now.getMonth() + 1;
  const targetYear = now.getFullYear();

  // Previous month
  const prevDate = new Date(targetYear, targetMonth - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  // Idempotency check: carry-forward already done for this month?
  const existing = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.category, "carry_forward"),
        sql`to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${`${targetYear}-${String(targetMonth).padStart(2, "0")}`}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.json({ created: false, amount: parseFloat(existing[0].amount as string) });
    return;
  }

  // Sum previous month income and expenses
  const [incomeRows, expenseRows] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "income"),
          sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${prevMonth}`,
          sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${prevYear}`
        )
      ),
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "expense"),
          sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${prevMonth}`,
          sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${prevYear}`
        )
      ),
  ]);

  const prevIncome = parseFloat(incomeRows[0]?.total ?? "0");
  const prevExpenses = parseFloat(expenseRows[0]?.total ?? "0");
  const balance = prevIncome - prevExpenses;

  if (balance <= 0) {
    res.json({ created: false, amount: 0 });
    return;
  }

  const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
  const prevMonthName = prevDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" });

  const [row] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: "income",
      amount: String(balance),
      category: "carry_forward",
      source: "Monthly Balance Carry Forward",
      date: dateStr,
      notes: `Auto-carried from ${prevMonthName}`,
      isRecurring: false,
    })
    .returning();

  res.status(201).json({ created: true, amount: balance, transaction: parseTransaction(row) });
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(transactionsTable).where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(GetTransactionResponse.parse(parseTransaction(row)));
});

router.patch("/transactions/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, ...rest } = parsed.data;
  const setData = { ...rest, ...(amount != null ? { amount: String(amount) } : {}) };
  const [row] = await db.update(transactionsTable).set(setData).where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(UpdateTransactionResponse.parse(parseTransaction(row)));
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(transactionsTable).where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.sendStatus(204);
});

export default router;
