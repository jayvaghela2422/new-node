import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
        email: { type: String, required: false, index: true },
        phone: { type: String, required: false },
        code: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ["email_verification", "phone_verification", "password_reset", "login"],
        },
        isUsed: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
    },
    { timestamps: true }
);

// TTL Index – deletes expired OTPs automatically
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, type: 1, createdAt: -1 });
otpSchema.index({ userId: 1, type: 1 });

// ✅ Static Method - Generate 6-digit random code
otpSchema.statics.generateCode = function () {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✅ Instance Methods
otpSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

otpSchema.methods.canAttempt = function () {
    return this.attempts < this.maxAttempts;
};

otpSchema.methods.verify = function (code) {
    return this.code === code && !this.isExpired() && this.canAttempt();
};

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
