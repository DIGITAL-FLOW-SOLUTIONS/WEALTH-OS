import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

router.get("/liabilities", async (_req, res): Promise<void> => {
  const rows = await db.select().from(liabilitiesTable).orderBy(liabilitiesTable.createdAt);
  res.json(ListLiabilitiesResponse.parse(rows.map(parseLiability)));
});

router.post("/liabilities", async (req, res): Promise<void> => {
  const parsed = CreateLiabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(liabilitiesTable).values(parsed.data).returning();
  res.status(201).json(parseLiability(row));
});

router.patch("/liabilities/:id", async (req, res): Promise<void> => {
  const params = UpdateLiabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLiabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(liabilitiesTable).set(parsed.data).where(eq(liabilitiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Liability not found" });
    return;
  }
  res.json(UpdateLiabilityResponse.parse(parseLiability(row)));
});

router.delete("/liabilities/:id", async (req, res): Promise<void> => {
  const params = DeleteLiabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(liabilitiesTable).where(eq(liabilitiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Liability not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
