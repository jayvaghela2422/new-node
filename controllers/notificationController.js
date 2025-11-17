import Notification from "../models/notificationModel.js";

/**
 * @desc Get all notifications for authenticated user
 * @route GET /api/notifications
 * @access Private
 */
export const getNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;

        // Build query filter
        const filter = { userId };
        if (unreadOnly === "true") {
            filter.read = false;
        }

        // Fetch notifications
        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit));

        // Format response
        const formatted = notifications.map((notif) => ({
            id: notif._id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            read: notif.read,
            createdAt: notif.createdAt.toISOString(),
            metadata: notif.metadata,
        }));

        res.status(200).json({
            success: true,
            data: formatted,
        });
    } catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * @desc Mark notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
export const markAsRead = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const notification = await Notification.findOne({ _id: id, userId });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        notification.read = true;
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: {
                id: notification._id,
                read: notification.read,
            },
        });
    } catch (error) {
        console.error("Mark notification as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * @desc Mark all notifications as read
 * @route PUT /api/notifications/read-all
 * @access Private
 */
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.userId;

        await Notification.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            message: "All notifications marked as read",
        });
    } catch (error) {
        console.error("Mark all as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * @desc Get unread notification count
 * @route GET /api/notifications/unread-count
 * @access Private
 */
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.userId;
        const count = await Notification.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: { count },
        });
    } catch (error) {
        console.error("Get unread count error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * @desc Create a new notification (utility function for internal use)
 * @param {Object} notificationData - Notification data
 */
export const createNotification = async (notificationData) => {
    try {
        const notification = new Notification(notificationData);
        await notification.save();
        return { success: true, notification };
    } catch (error) {
        console.error("Create notification error:", error);
        return { success: false, error: error.message };
    }
};