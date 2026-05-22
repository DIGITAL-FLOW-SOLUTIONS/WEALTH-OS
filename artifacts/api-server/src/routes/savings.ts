import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

router.get("/savings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(savingsTable).orderBy(savingsTable.date);
  res.json(ListSavingsResponse.parse(rows.map(parseSavings)));
});

router.post("/savings", async (req, res): Promise<void> => {
  const parsed = CreateSavingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(savingsTable).values(parsed.data).returning();
  res.status(201).json(parseSavings(row));
});

router.patch("/savings/:id", async (req, res): Promise<void> => {
  const params = UpdateSavingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSavingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(savingsTable).set(parsed.data).where(eq(savingsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Savings record not found" });
    return;
  }
  res.json(UpdateSavingsResponse.parse(parseSavings(row)));
});

router.delete("/savings/:id", async (req, res): Promise<void> => {
  const params = DeleteSavingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(savingsTable).where(eq(savingsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Savings record not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
