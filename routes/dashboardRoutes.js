import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = Router();
router.get("/stats", authMiddleware, getDashboardStats);
export default router;
