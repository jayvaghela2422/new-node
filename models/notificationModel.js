import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                "appointment_reminder",
                "appointment_cancelled",
                "appointment_rescheduled",
                "recording_processed",
                "analysis_complete",
                "low_spin_score",
                "achievement_unlocked",
                "weekly_report",
                "system_update",
                "appointment_created",
                "recording_uploaded",
                "system_alert",
                "other",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            maxlength: 500,
        },
        read: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
        },
        data: {
            appointmentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Appointment",
            },
            recordingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Recording",
            },
            actionUrl: String,
            metadata: mongoose.Schema.Types.Mixed,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },
        channels: {
            type: [String],
            enum: ["in_app", "email", "push", "sms"],
            default: ["in_app"],
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
    },
    { timestamps: true }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance Methods
notificationSchema.methods.markAsRead = function () {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

// Static Methods
notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId, read: false });
};

notificationSchema.statics.markAllAsRead = async function (userId) {
    const now = new Date();
    return this.updateMany(
        { userId, read: false },
        { $set: { read: true, readAt: now } }
    );
};

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;