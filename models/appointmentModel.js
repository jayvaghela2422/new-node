import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        client: {
            name: { type: String, required: true },
            email: { type: String },
            phone: { type: String },
            company: { type: String },
            position: { type: String },
        },
        scheduledDate: {
            type: Date,
            required: true,
        },
        duration: {
            type: Number,
            default: 30,
            min: 15,
            max: 240,
        },
        type: {
            type: String,
            enum: ["discovery", "demo", "follow_up", "closing", "support", "other"],
            default: "discovery",
        },
        status: {
            type: String,
            enum: ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
            default: "scheduled",
        },
        location: {
            type: {
                type: String,
                enum: ["in_person", "phone", "video", "other"],
            },
            address: { type: String },
            meetingLink: { type: String },
            phoneNumber: { type: String },
        },
        notes: { type: String, maxlength: 2000 },
        agenda: [
            {
                item: { type: String },
                duration: { type: Number },
            },
        ],
        outcome: {
            status: {
                type: String,
                enum: ["successful", "needs_follow_up", "not_interested", "rescheduled", "no_show"],
            },
            notes: { type: String },
            nextSteps: { type: String },
            recordingId: { type: mongoose.Schema.Types.ObjectId, ref: "Recording" },
        },
        reminders: [
            {
                type: {
                    type: String,
                    enum: ["email", "sms", "push"],
                },
                minutesBefore: { type: Number },
                sent: { type: Boolean, default: false },
                sentAt: { type: Date },
            },
        ],
        tags: [String],
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },
    },
    { timestamps: true }
);

appointmentSchema.index({ userId: 1, scheduledDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ "client.email": 1 });
appointmentSchema.index({ tags: 1 });

// Virtual Fields
appointmentSchema.virtual("isUpcoming").get(function () {
    return (
        this.scheduledDate > new Date() &&
        (this.status === "scheduled" || this.status === "confirmed")
    );
});

appointmentSchema.virtual("isPast").get(function () {
    return this.scheduledDate < new Date();
});

// Instance Methods
appointmentSchema.methods.canCancel = function () {
    return (
        this.status === "scheduled" ||
        this.status === "confirmed"
    ) && this.scheduledDate > new Date();
};

appointmentSchema.methods.canReschedule = function () {
    return (
        this.status === "scheduled" ||
        this.status === "confirmed"
    ) && this.scheduledDate > new Date();
};

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;
