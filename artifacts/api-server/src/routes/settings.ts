import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseSettings(s: typeof settingsTable.$inferSelect) {
  return {
    ...s,
    emergencyFundMonths: parseFloat(s.emergencyFundMonths as string),
    emergencyFundMonthlyAmount: parseFloat(s.emergencyFundMonthlyAmount as string),
    usdConversionRate: parseFloat(s.usdConversionRate as string),
  };
}

async function ensureSettings(userId: string) {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(settingsTable).values({ userId }).returning();
    return row;
  }
  return rows[0];
}

router.get("/settings", async (req, res): Promise<void> => {
  const userId = req.userId;
  const settings = await ensureSettings(userId);
  res.json(GetSettingsResponse.parse(parseSettings(settings)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await ensureSettings(userId);
  const { emergencyFundMonths, emergencyFundMonthlyAmount, usdConversionRate, ...rest } = parsed.data;
  const setData = {
    ...rest,
    ...(emergencyFundMonths != null ? { emergencyFundMonths: String(emergencyFundMonths) } : {}),
    ...(emergencyFundMonthlyAmount != null ? { emergencyFundMonthlyAmount: String(emergencyFundMonthlyAmount) } : {}),
    ...(usdConversionRate != null ? { usdConversionRate: String(usdConversionRate) } : {}),
  };
  const [row] = await db.update(settingsTable).set(setData).where(eq(settingsTable.id, existing.id)).returning();
  res.json(UpdateSettingsResponse.parse(parseSettings(row)));
});

export default router;
