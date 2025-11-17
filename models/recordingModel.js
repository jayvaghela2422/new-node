import mongoose from "mongoose";

const recordingSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            maxlength: 1000,
        },
        audio: {
            fileName: { type: String, required: true },
            fileUrl: { type: String, required: true },
            fileSize: { type: Number, required: true },
            duration: { type: Number, required: true },
            displayDuration: { type: String },
            format: { type: String },
            transcriptionUrl: { type: String },
        },
        clientName: { type: String },
        clientCompany: { type: String },
        metadata: {
            recordedAt: { type: Date },
            deviceType: { type: String },
            platform: { type: String },
            location: {
                type: {
                    type: String,
                    enum: ["Point"],
                    default: undefined,
                },
                coordinates: {
                    type: [Number], // [longitude, latitude]
                    default: undefined,
                },
            },
        },
        analysis: {
            status: {
                type: String,
                enum: ["pending", "processing", "completed", "failed"],
                default: "pending",
            },
            processedAt: Date,
            transcription: {
                text: { type: String, maxlength: 50000 },
                segments: [
                    {
                        speaker: String,
                        startTime: Number,
                        endTime: Number,
                        text: String,
                        confidence: Number,
                    },
                ],
                speakerCount: Number,
                language: String,
            },
            sentiment: {
                overall: {
                    type: String,
                    enum: ["very_positive", "positive", "neutral", "negative", "very_negative"],
                },
                score: {
                    type: Number,
                    min: -1,
                    max: 1,
                },
                timeline: [
                    {
                        timestamp: Number,
                        sentiment: String,
                        score: Number,
                    },
                ],
            },
            spin: {
                situation: {
                    score: Number,
                    count: Number,
                    examples: [String],
                    suggestions: [String],
                },
                problem: {
                    score: Number,
                    count: Number,
                    examples: [String],
                    suggestions: [String],
                },
                implication: {
                    score: Number,
                    count: Number,
                    examples: [String],
                    suggestions: [String],
                },
                needPayoff: {
                    score: Number,
                    count: Number,
                    examples: [String],
                    suggestions: [String],
                },
                overall: {
                    score: Number,
                    totalQuestions: Number,
                    strengths: [String],
                    weaknesses: [String],
                    recommendations: [String],
                },
            },
            keyMoments: [
                {
                    timestamp: String,
                    type: {
                        type: String,
                        enum: ["objection_handled", "pain_point_identified", "closing_opportunity", "rapport_building"],
                    },
                    description: String,
                },
            ],
            keywords: [String],
            topics: [String],
            actionItems: [String],
            insights: [String],
        },
        tags: [String],
        isShared: {
            type: Boolean,
            default: false,
        },
        sharedWith: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                permissions: { type: String, enum: ["view", "comment", "edit"] },
                sharedAt: { type: Date },
            },
        ],
        notes: {
            type: String,
            maxlength: 5000,
        },
        status: {
            type: String,
            enum: ["active", "archived", "deleted"],
            default: "active",
        },
    },
    { timestamps: true }
);

recordingSchema.index({ userId: 1, createdAt: -1 });
recordingSchema.index({ appointmentId: 1 });
recordingSchema.index({ "analysis.status": 1 });
recordingSchema.index({ tags: 1 });
recordingSchema.index({ status: 1 });
recordingSchema.index({ "audio.duration": 1 });
recordingSchema.index({ "metadata.recordedAt": 1 });
recordingSchema.index({ "metadata.location": "2dsphere" });

// Virtual Fields
recordingSchema.virtual("avgSpinScore").get(function () {
    if (!this.analysis?.spin) return 0;
    const scores = [
        this.analysis.spin.situation?.score,
        this.analysis.spin.problem?.score,
        this.analysis.spin.implication?.score,
        this.analysis.spin.needPayoff?.score,
    ].filter((s) => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
});

// Instance Methods
recordingSchema.methods.canDelete = function (userId) {
    return this.userId.toString() === userId.toString();
};

recordingSchema.methods.canEdit = function (userId) {
    if (this.userId.toString() === userId.toString()) return true;
    const sharedUser = this.sharedWith.find((s) => s.userId.toString() === userId.toString());
    return sharedUser && sharedUser.permissions === "edit";
};

recordingSchema.methods.hasAccess = function (userId) {
    if (this.userId.toString() === userId.toString()) return true;
    return this.sharedWith.some((s) => s.userId.toString() === userId.toString());
};

const Recording = mongoose.model("Recording", recordingSchema);
export default Recording;
