import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, investmentsTable } from "@workspace/db";
import {
  ListInvestmentsResponse,
  CreateInvestmentBody,
  UpdateInvestmentParams,
  UpdateInvestmentBody,
  UpdateInvestmentResponse,
  DeleteInvestmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseInvestment(i: typeof investmentsTable.$inferSelect) {
  return {
    ...i,
    purchaseValue: parseFloat(i.purchaseValue as string),
    currentValue: parseFloat(i.currentValue as string),
    returnPercent: i.returnPercent != null ? parseFloat(i.returnPercent as string) : null,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
  };
}

router.get("/investments", async (_req, res): Promise<void> => {
  const rows = await db.select().from(investmentsTable).orderBy(investmentsTable.createdAt);
  res.json(ListInvestmentsResponse.parse(rows.map(parseInvestment)));
});

router.post("/investments", async (req, res): Promise<void> => {
  const parsed = CreateInvestmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(investmentsTable).values(parsed.data).returning();
  res.status(201).json(parseInvestment(row));
});

router.patch("/investments/:id", async (req, res): Promise<void> => {
  const params = UpdateInvestmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInvestmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(investmentsTable).set(parsed.data).where(eq(investmentsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
  res.json(UpdateInvestmentResponse.parse(parseInvestment(row)));
});

router.delete("/investments/:id", async (req, res): Promise<void> => {
  const params = DeleteInvestmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(investmentsTable).where(eq(investmentsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
