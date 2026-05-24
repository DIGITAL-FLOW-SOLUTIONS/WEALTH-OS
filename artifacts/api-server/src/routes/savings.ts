import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, savingsTable } from "@workspace/db";
import {
  ListSavingsResponse,
  CreateSavingsBody,
  UpdateSavingsParams,
  UpdateSavingsBody,
  UpdateSavingsResponse,
  DeleteSavingsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseSavings(s: typeof savingsTable.$inferSelect) {
  return {
    ...s,
    amount: parseFloat(s.amount as string),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

router.get("/savings", async (req, res): Promise<void> => {
  const userId = req.userId;
  const rows = await db.select().from(savingsTable).where(eq(savingsTable.userId, userId)).orderBy(savingsTable.date);
  res.json(ListSavingsResponse.parse(rows.map(parseSavings)));
});

router.post("/savings", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateSavingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, ...rest } = parsed.data;
  const [row] = await db.insert(savingsTable).values({ ...rest, amount: String(amount), userId }).returning();
  res.status(201).json(parseSavings(row));
});

router.patch("/savings/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateSavingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSavingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, ...rest } = parsed.data;
  const setData = { ...rest, ...(amount != null ? { amount: String(amount) } : {}) };
  const [row] = await db.update(savingsTable).set(setData).where(and(eq(savingsTable.id, params.data.id), eq(savingsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Savings record not found" }); return; }
  res.json(UpdateSavingsResponse.parse(parseSavings(row)));
});

router.delete("/savings/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteSavingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(savingsTable).where(and(eq(savingsTable.id, params.data.id), eq(savingsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Savings record not found" }); return; }
  res.sendStatus(204);
});

export default router;
