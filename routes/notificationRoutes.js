import { Router } from "express";
import { getNotifications, markAsRead, markAllAsRead, getUnreadCount } from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/notifications
router.get("/", authMiddleware, getNotifications);

// GET /api/notifications/unread-count
router.get("/unread-count", authMiddleware, getUnreadCount);

// PUT /api/notifications/:id/read
router.put("/:id/read", authMiddleware, markAsRead);

// PUT /api/notifications/read-all
router.put("/read-all", authMiddleware, markAllAsRead);

export default router;