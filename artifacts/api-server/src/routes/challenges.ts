import { Router } from "express";
import { db } from "@workspace/db";
import { challengesTable, transactionsTable } from "@workspace/db";
import { and, eq, gt, isNull, notInArray, sql, sum } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

function parseChallenge(row: typeof challengesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    targetAmount: row.targetAmount != null ? parseFloat(row.targetAmount as string) : null,
    difficulty: row.difficulty,
    xpReward: row.xpReward,
    expiresAt: row.expiresAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 3600_000);
}
function addDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}
function round100(n: number): number {
  return Math.max(100, Math.round(n / 100) * 100);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type ChallengeTemplate = {
  title: string;
  description: string;
  category: string;
  targetAmount: number | null;
  difficulty: string;
  xpReward: number;
  expiresAt: Date;
};

function buildPool(income: number, _expenses: number): { small: ChallengeTemplate[]; medium: ChallengeTemplate[]; large: ChallengeTemplate[] } {
  const base = Math.max(5000, income);
  const s = round100(base * 0.01);
  const m = round100(base * 0.05);
  const l = round100(base * 0.10);

  const small: ChallengeTemplate[] = [
    { title: `💰 Stash KES ${s.toLocaleString()}`, description: `Drop KES ${s.toLocaleString()} into your savings account today. Small moves compound into big wealth.`, category: "savings", targetAmount: s, difficulty: "small", xpReward: 10, expiresAt: addHours(24) },
    { title: `📈 MMF Starter — KES ${s.toLocaleString()}`, description: `Put KES ${s.toLocaleString()} in a Money Market Fund. Even small amounts earn daily interest!`, category: "mmf", targetAmount: s, difficulty: "small", xpReward: 15, expiresAt: addHours(36) },
    { title: `🎯 Goal Check-In`, description: `Update progress on one of your active goals today. Tracking is the secret to achieving.`, category: "goals", targetAmount: null, difficulty: "small", xpReward: 10, expiresAt: addHours(36) },
    { title: `🍽️ No Eating Out Today`, description: `Cook at home for every meal today. Bank what you'd have spent — every shilling counts.`, category: "spending", targetAmount: null, difficulty: "small", xpReward: 10, expiresAt: addHours(24) },
    { title: `🔍 Research One Investment`, description: `Spend 15 minutes today reading about one investment option. Knowledge is your greatest asset.`, category: "investment", targetAmount: null, difficulty: "small", xpReward: 10, expiresAt: addHours(36) },
  ];

  const medium: ChallengeTemplate[] = [
    { title: `🏦 Save KES ${m.toLocaleString()} This Week`, description: `Challenge yourself to save KES ${m.toLocaleString()} by end of week. Your future is watching.`, category: "savings", targetAmount: m, difficulty: "medium", xpReward: 25, expiresAt: addDays(3) },
    { title: `📊 Grow Your MMF — KES ${m.toLocaleString()}`, description: `Invest KES ${m.toLocaleString()} in your MMF this week. Time in the market beats timing the market.`, category: "mmf", targetAmount: m, difficulty: "medium", xpReward: 30, expiresAt: addDays(4) },
    { title: `🏆 Goal Boost — KES ${m.toLocaleString()}`, description: `Add KES ${m.toLocaleString()} toward your top priority goal this week. Finish lines are closer than you think.`, category: "goals", targetAmount: m, difficulty: "medium", xpReward: 30, expiresAt: addDays(5) },
    { title: `📵 3-Day No-Impulse Challenge`, description: `Go 3 full days without any unplanned purchases. Think before every swipe for 72 hours.`, category: "spending", targetAmount: null, difficulty: "medium", xpReward: 25, expiresAt: addDays(3) },
    { title: `💼 Invest KES ${m.toLocaleString()}`, description: `Allocate KES ${m.toLocaleString()} to your investment portfolio this week. Compound interest rewards the patient.`, category: "investment", targetAmount: m, difficulty: "medium", xpReward: 35, expiresAt: addDays(5) },
  ];

  const large: ChallengeTemplate[] = [
    { title: `🚀 Savings Surge — KES ${l.toLocaleString()}`, description: `Push KES ${l.toLocaleString()} to savings this month. Every shilling on this journey matters.`, category: "savings", targetAmount: l, difficulty: "large", xpReward: 50, expiresAt: addDays(7) },
    { title: `💎 MMF Power Move — KES ${l.toLocaleString()}`, description: `Add KES ${l.toLocaleString()} to your Money Market Fund. Watch it compound into something beautiful.`, category: "mmf", targetAmount: l, difficulty: "large", xpReward: 60, expiresAt: addDays(7) },
    { title: `🌟 Goal Sprint — KES ${l.toLocaleString()}`, description: `Put KES ${l.toLocaleString()} toward completing your biggest goal. This is your week!`, category: "goals", targetAmount: l, difficulty: "large", xpReward: 75, expiresAt: addDays(7) },
    { title: `🏦 Portfolio Push — KES ${l.toLocaleString()}`, description: `Add KES ${l.toLocaleString()} to investments this month. Build the portfolio that funds your freedom.`, category: "investment", targetAmount: l, difficulty: "large", xpReward: 70, expiresAt: addDays(7) },
  ];

  return { small, medium, large };
}

router.get("/challenges", async (req, res): Promise<void> => {
  const userId = req.userId;
  const now = new Date();

  const active = await db
    .select()
    .from(challengesTable)
    .where(and(eq(challengesTable.userId, userId), gt(challengesTable.expiresAt, now), isNull(challengesTable.completedAt)))
    .orderBy(challengesTable.createdAt);

  const completed = await db
    .select({ xp: challengesTable.xpReward })
    .from(challengesTable)
    .where(and(eq(challengesTable.userId, userId), sql`${challengesTable.completedAt} IS NOT NULL`));

  const totalXp = completed.reduce((s, r) => s + r.xp, 0);

  res.json({ challenges: active.map(parseChallenge), totalXp });
});

router.post("/challenges/generate", async (req, res): Promise<void> => {
  const userId = req.userId;
  const now = new Date();

  const existing = await db
    .select()
    .from(challengesTable)
    .where(and(eq(challengesTable.userId, userId), gt(challengesTable.expiresAt, now), isNull(challengesTable.completedAt)));

  if (existing.length >= 3) {
    res.json({ challenges: existing.map(parseChallenge) });
    return;
  }

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [incomeRow, expenseRow] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "income"),
          notInArray(transactionsTable.category, ["carry_forward", "last_balance"]),
          sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
          sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
        )
      ),
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "expense"),
          sql`EXTRACT(MONTH FROM ${transactionsTable.date}::date) = ${month}`,
          sql`EXTRACT(YEAR FROM ${transactionsTable.date}::date) = ${year}`
        )
      ),
  ]);

  const income = parseFloat(incomeRow[0]?.total ?? "0");
  const expenses = parseFloat(expenseRow[0]?.total ?? "0");
  const pool = buildPool(income, expenses);

  const toCreate = [pick(pool.small), pick(pool.medium), pick(pool.large)];

  const rows = await Promise.all(
    toCreate.map((c) =>
      db
        .insert(challengesTable)
        .values({
          userId,
          title: c.title,
          description: c.description,
          category: c.category,
          targetAmount: c.targetAmount != null ? String(c.targetAmount) : null,
          difficulty: c.difficulty,
          xpReward: c.xpReward,
          expiresAt: c.expiresAt,
        })
        .returning()
    )
  );

  res.json({ challenges: rows.flatMap((r) => r).map(parseChallenge) });
});

router.patch("/challenges/:id/complete", async (req, res): Promise<void> => {
  const userId = req.userId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .update(challengesTable)
    .set({ completedAt: new Date() })
    .where(and(eq(challengesTable.id, id), eq(challengesTable.userId, userId)))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(parseChallenge(row));
});

router.delete("/challenges/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(challengesTable).where(and(eq(challengesTable.id, id), eq(challengesTable.userId, userId)));
  res.json({ ok: true });
});

export default router;
