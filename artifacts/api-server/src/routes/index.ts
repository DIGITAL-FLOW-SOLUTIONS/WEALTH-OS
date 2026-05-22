import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import savingsRouter from "./savings";
import goalsRouter from "./goals";
import investmentsRouter from "./investments";
import assetsRouter from "./assets";
import liabilitiesRouter from "./liabilities";
import budgetsRouter from "./budgets";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(savingsRouter);
router.use(goalsRouter);
router.use(investmentsRouter);
router.use(assetsRouter);
router.use(liabilitiesRouter);
router.use(budgetsRouter);
router.use(settingsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);

export default router;
