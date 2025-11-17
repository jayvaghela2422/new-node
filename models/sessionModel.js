import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        token: {
            type: String,
            required: true,
            index: true,
            unique: true
        },
        refreshToken: {
            type: String,
            index: true,
            unique: true,
            sparse: true
        },
        deviceInfo: {
            deviceType: {
                type: String,
                enum: ["mobile", "tablet", "desktop", "unknown"],
                default: "unknown",
            },
            platform: {
                type: String,
                enum: ["ios", "android", "web", "other"],
                default: "other",
            },
            appVersion: String,
            osVersion: String,
            deviceModel: String,
        },
        ipAddress: String,
        userAgent: String,
        location: {
            country: String,
            city: String,
            coordinates: {
                type: {
                    type: String,
                    enum: ["Point"],
                },
                coordinates: {
                    type: [Number], // [longitude, latitude]
                },
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastActivity: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
    },
    { timestamps: true }
);

// Indexes
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ token: 1 }, { unique: true });
sessionSchema.index({ refreshToken: 1 }, { unique: true, sparse: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ "location.coordinates": "2dsphere" });
sessionSchema.index({ userId: 1, isActive: 1 });

// Instance Methods
sessionSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

sessionSchema.methods.updateActivity = function () {
    this.lastActivity = new Date();
    return this.save();
};

sessionSchema.methods.revoke = function () {
    this.isActive = false;
    return this.save();
};

// Static Methods
sessionSchema.statics.revokeAllUserSessions = async function (userId) {
    return this.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false } }
    );
};

sessionSchema.statics.cleanupExpired = async function () {
    return this.deleteMany({
        $or: [
            { expiresAt: { $lt: new Date() } },
            { isActive: false, updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
    });
};

const Session = mongoose.model("Session", sessionSchema);
export default Session;