import { Router } from "express";
import { getSummary, getDepartmentStats, getTrend, getWorkerPerformance, getRecentActivity } from "../controllers/analytics.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate, authorize("officer","admin"));

router.get("/summary",          getSummary);
router.get("/departments",      getDepartmentStats);
router.get("/trend",            getTrend);
router.get("/workers",          getWorkerPerformance);
router.get("/recent-activity",  getRecentActivity);

export default router;
