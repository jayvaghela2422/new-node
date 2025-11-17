import Recording from "../models/recordingModel.js";
import { uploadRecordingToFireflies, getFirefliesRecordings } from "../utils/firefliesService.js";
import User from "../models/userModel.js";
import { sendRecordingNotification } from "../utils/emailService.js";

/**
 * @desc Upload recording to Fireflies and store in MongoDB
 * @route POST /api/fireflies/upload
 * @access Private
 */
export const uploadRecording = async (req, res) => {
    try {
        const { fileUrl, appointmentId, metadata } = req.body;
        const userId = req.userId;

        if (!fileUrl)
            return res.status(400).json({
                success: false,
                message: "fileUrl is required",
            });

        let meta = {};
        if (metadata) {
            try {
                meta = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid metadata format. Must be a valid JSON string.",
                });
            }
        }


        const result = await uploadRecordingToFireflies(fileUrl);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload recording to Fireflies",
                error: result.error,
            });
        }

        const recordingData = result.data;

        //Prepare recording document (matches new schema)
        const newRecording = new Recording({
            userId,
            appointmentId,
            title: recordingData.title || "Untitled Meeting",
            description: recordingData.message || "",
            audio: {
                fileName: recordingData.title || "recording.mp3",
                fileUrl: fileUrl,
                fileSize: meta.fileSize || null,
                duration: meta.duration || null,
                format: fileUrl.split(".").pop() || "mp3",
            },
            metadata: {
                recordedAt: meta.recordedAt ? new Date(meta.recordedAt) : new Date(),
                deviceType: meta.deviceType || "unknown",
                platform: meta.platform || "web",
            },
            analysis: {
                status: "pending",
            },
            status: "active",
        });

        await newRecording.save();

        // Send email notification
        try {
            const user = await User.findById(userId);
            if (user && user.email) {
                await sendRecordingNotification(
                    newRecording,
                    user.email,
                    user.name
                );
            }
        } catch (emailError) {
            console.error('Failed to send recording notification:', emailError);
        }


        res.status(201).json({
            success: true,
            message: "Recording uploaded successfully to Fireflies and saved locally",
            data: {
                id: newRecording._id,
                appointmentId: newRecording.appointmentId,
                duration:
                    newRecording.audio.duration && !isNaN(newRecording.audio.duration)
                        ? `${Math.floor(newRecording.audio.duration / 60)
                            .toString()
                            .padStart(2, "0")}:${(newRecording.audio.duration % 60)
                                .toString()
                                .padStart(2, "0")}`
                        : "00:00",
                date: newRecording.metadata.recordedAt
                    ? newRecording.metadata.recordedAt.toISOString().split("T")[0]
                    : newRecording.createdAt.toISOString().split("T")[0],
                analyzed: false,
                fileUrl: newRecording.audio.fileUrl,
                status: newRecording.analysis.status,
            },
        });
    } catch (error) {
        console.error("🔥 Fireflies upload error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * @desc Fetch all Fireflies recordings (from their API)
 * @route GET /api/fireflies/recordings
 */
export const getRecordings = async (req, res) => {
    try {
        const result = await getFirefliesRecordings();
        if (!result.success)
            return res.status(500).json({
                success: false,
                message: "Failed to fetch recordings",
                error: result.error,
            });

        res.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Get all recordings uploaded by the authenticated user (local DB)
 * @route GET /api/fireflies/my-recordings
 */
export const getUserRecordings = async (req, res) => {
    try {
        const userId = req.userId;
        const recordings = await Recording.find({ userId }).sort({ createdAt: -1 });

        const formatted = recordings.map((r) => ({
            id: r._id,
            appointmentId: r.appointmentId,
            duration: r.audio?.duration
                ? `${Math.floor(r.audio.duration / 60)
                    .toString()
                    .padStart(2, "0")}:${(r.audio.duration % 60)
                        .toString()
                        .padStart(2, "0")}`
                : "00:00",
            date: r.metadata?.recordedAt
                ? new Date(r.metadata.recordedAt).toISOString().split("T")[0]
                : new Date(r.createdAt).toISOString().split("T")[0],
            analyzed: r.analysis?.status === "completed",
            fileUrl: r.audio?.fileUrl,
            status: r.analysis?.status,
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Get detailed analysis for a specific Fireflies recording
 * @route GET /api/fireflies/recordings/:id/analysis
 * @access Private
 */
export const getFirefliesRecordingAnalysis = async (req, res) => {
    try {
        const recording = await Recording.findOne({
            _id: req.params.id,
            userId: req.userId,
            source: 'fireflies'
        });

        if (!recording) {
            return res.status(404).json({
                success: false,
                message: "Recording not found or access denied"
            });
        }

        if (!recording.analysis || Object.keys(recording.analysis).length === 0) {
            return res.json({
                success: true,
                data: {
                    status: 'pending',
                    message: 'Analysis is still in progress. Please check back later.'
                }
            });
        }

        if (recording.analysis.status !== 'completed') {
            return res.json({
                success: true,
                data: {
                    status: 'processing',
                    message: 'Analysis is still in progress'
                }
            });
        }

        res.json({
            success: true,
            data: {
                id: recording._id,
                status: recording.analysis.status,
                summary: recording.analysis.summary,
                keyPoints: recording.analysis.keyPoints,
                actionItems: recording.analysis.actionItems,
                sentiment: recording.analysis.sentiment,
                topics: recording.analysis.topics,
                transcript: recording.analysis.transcript,
                participants: recording.analysis.participants,
                recordingUrl: recording.recordingUrl,
                firefliesId: recording.firefliesId,
                createdAt: recording.createdAt,
                updatedAt: recording.updatedAt
            }
        });
    } catch (error) {
        console.error('Get Fireflies recording analysis error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};