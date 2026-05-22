import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  ListGoalsResponse,
  CreateGoalBody,
  UpdateGoalParams,
  UpdateGoalBody,
  UpdateGoalResponse,
  DeleteGoalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseGoal(g: typeof goalsTable.$inferSelect) {
  return {
    ...g,
    targetAmount: parseFloat(g.targetAmount as string),
    currentAmount: parseFloat(g.currentAmount as string),
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

router.get("/goals", async (_req, res): Promise<void> => {
  const rows = await db.select().from(goalsTable).orderBy(goalsTable.createdAt);
  res.json(ListGoalsResponse.parse(rows.map(parseGoal)));
});

router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(goalsTable).values(parsed.data).returning();
  res.status(201).json(parseGoal(row));
});

router.patch("/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(goalsTable).set(parsed.data).where(eq(goalsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(UpdateGoalResponse.parse(parseGoal(row)));
});

router.delete("/goals/:id", async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(goalsTable).where(eq(goalsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
