import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assetsTable } from "@workspace/db";
import {
  ListAssetsResponse,
  CreateAssetBody,
  UpdateAssetParams,
  UpdateAssetBody,
  UpdateAssetResponse,
  DeleteAssetParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseAsset(a: typeof assetsTable.$inferSelect) {
  return {
    ...a,
    value: parseFloat(a.value as string),
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  };
}

router.get("/assets", async (req, res): Promise<void> => {
  const userId = req.userId;
  const rows = await db.select().from(assetsTable).where(eq(assetsTable.userId, userId)).orderBy(assetsTable.createdAt);
  res.json(ListAssetsResponse.parse(rows.map(parseAsset)));
});

router.post("/assets", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { value, ...rest } = parsed.data;
  const [row] = await db.insert(assetsTable).values({ ...rest, value: String(value), userId }).returning();
  res.status(201).json(parseAsset(row));
});

router.patch("/assets/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateAssetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { value, ...rest } = parsed.data;
  const setData = { ...rest, ...(value != null ? { value: String(value) } : {}) };
  const [row] = await db.update(assetsTable).set(setData).where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Asset not found" }); return; }
  res.json(UpdateAssetResponse.parse(parseAsset(row)));
});

router.delete("/assets/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteAssetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(assetsTable).where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Asset not found" }); return; }
  res.sendStatus(204);
});

export default router;
