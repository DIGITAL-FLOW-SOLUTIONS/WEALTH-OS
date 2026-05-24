import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, liabilitiesTable } from "@workspace/db";
import {
  ListLiabilitiesResponse,
  CreateLiabilityBody,
  UpdateLiabilityParams,
  UpdateLiabilityBody,
  UpdateLiabilityResponse,
  DeleteLiabilityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseLiability(l: typeof liabilitiesTable.$inferSelect) {
  return {
    ...l,
    amount: parseFloat(l.amount as string),
    interestRate: l.interestRate != null ? parseFloat(l.interestRate as string) : null,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  };
}

router.get("/liabilities", async (req, res): Promise<void> => {
  const userId = req.userId;
  const rows = await db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)).orderBy(liabilitiesTable.createdAt);
  res.json(ListLiabilitiesResponse.parse(rows.map(parseLiability)));
});

router.post("/liabilities", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateLiabilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, interestRate, ...rest } = parsed.data;
  const [row] = await db.insert(liabilitiesTable).values({
    ...rest,
    amount: String(amount),
    ...(interestRate != null ? { interestRate: String(interestRate) } : {}),
    userId,
  }).returning();
  res.status(201).json(parseLiability(row));
});

router.patch("/liabilities/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateLiabilityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateLiabilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { amount, interestRate, ...rest } = parsed.data;
  const setData = {
    ...rest,
    ...(amount != null ? { amount: String(amount) } : {}),
    ...(interestRate != null ? { interestRate: String(interestRate) } : {}),
  };
  const [row] = await db.update(liabilitiesTable).set(setData).where(and(eq(liabilitiesTable.id, params.data.id), eq(liabilitiesTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Liability not found" }); return; }
  res.json(UpdateLiabilityResponse.parse(parseLiability(row)));
});

router.delete("/liabilities/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteLiabilityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(liabilitiesTable).where(and(eq(liabilitiesTable.id, params.data.id), eq(liabilitiesTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Liability not found" }); return; }
  res.sendStatus(204);
});

export default router;
