import fs from "fs";
import path from "path";
import multer from "multer";
import Appointment from "../models/appointmentModel.js";
import Recording from "../models/recordingModel.js";
import User from "../models/userModel.js";
import { sendRecordingNotification } from "../utils/emailService.js";
import { uploadBufferToS3 } from "../utils/s3Uploader.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});


const storage = multer.memoryStorage();

// // setup multer (unchanged)
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const uploadDir = "uploads/recordings";
//         if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
//         cb(null, uploadDir);
//     },
//     filename: function (req, file, cb) {
//         cb(null, `${Date.now()}-${file.originalname}`);
//     },
// });

export const upload = multer({ storage });

// main controller
export const uploadRecording = async (req, res) => {
    try {
        const userId = req.userId;
        const { appointmentId, metadata } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Audio file is required" });
        }

        //Validate appointmentId
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            // delete uploaded file since appointment is invalid
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Invalid appointmentId. Appointment not found.",
            });
        }

        let parsedMetadata = {};
        try {
            parsedMetadata = metadata ? JSON.parse(metadata) : {};
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid metadata format. Must be valid JSON.",
            });
        }

        const newRecording = new Recording({
            userId,
            appointmentId,
            title: req.file.originalname,
            description: parsedMetadata.description || "",
            audio: {
                fileName: req.file.originalname,
                fileUrl: `/uploads/recordings/${req.file.filename}`,
                fileSize: req.file.size,
                duration: parsedMetadata.duration || 0,
                format: path.extname(req.file.originalname).replace(".", ""),
            },
            metadata: {
                recordedAt: parsedMetadata.recordedAt || new Date(),
                deviceType: parsedMetadata.deviceType || "unknown",
                platform: parsedMetadata.platform || "unknown",
            },
            analysis: { status: "pending" },
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
            message: "Recording uploaded successfully",
            data: {
                id: newRecording._id,
                appointmentId: newRecording.appointmentId,
                duration: parsedMetadata.duration,
                date: new Date(parsedMetadata.recordedAt).toISOString().split("T")[0],
                analyzed: false,
                fileUrl: newRecording.audio.fileUrl,
                status: newRecording.status,
            },
        });
    } catch (error) {
        console.error("Upload recording error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


const getSignedFileUrl = async (key) => {
    console.log("Getting signed URL for key:", key);
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
    });

    return await getSignedUrl(s3, command, {
        expiresIn: 3600, // 1 hour
    });
};


/**
 * @desc Get all recordings for the authenticated user
 * @route GET /api/recordings
 * @access Private
 */
export const getAllRecordings = async (req, res) => {
    try {
        const userId = req.userId;
        const { analyzed, appointmentId, limit = 50, offset = 0 } = req.query;

        //Build query filter
        const filter = { userId };

        if (appointmentId) filter.appointmentId = appointmentId;

        if (typeof analyzed !== "undefined") {
            filter["analysis.status"] =
                analyzed === "true" ? "completed" : { $ne: "completed" };
        }

        //Query database
        const recordings = await Recording.find(filter)
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit));

        const formatted = await Promise.all(
            recordings.map(async (r) => {
                const signedUrl = r.audio?.fileName
                    ? await getSignedFileUrl(r.audio.fileName)
                    : null;
                console.log("signedUrl", signedUrl);
                return {
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
                    spinScore: r.analysis?.spin?.overall?.score || null,
                    sentiment: r.analysis?.sentiment?.overall || null,

                    // IMPORTANT CHANGE HERE
                    fileUrl: signedUrl,
                    transcriptionUrl: r.audio?.transcriptionUrl || null,
                };
            })
        );

        res.status(200).json({
            success: true,
            message: "All recordings retrieved successfully.",
            data: formatted,
        });
    } catch (error) {
        console.error("Get recordings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// export const getAllRecordings = async (req, res) => {
//     try {
//         const userId = req.userId;
//         const { analyzed, appointmentId, limit = 50, offset = 0 } = req.query;

//         //Build query filter
//         const filter = { userId };

//         if (appointmentId) filter.appointmentId = appointmentId;

//         if (typeof analyzed !== "undefined") {
//             filter["analysis.status"] =
//                 analyzed === "true" ? "completed" : { $ne: "completed" };
//         }

//         //Query database
//         const recordings = await Recording.find(filter)
//             .sort({ createdAt: -1 })
//             .skip(Number(offset))
//             .limit(Number(limit));

//         //Format response
//         const formatted = recordings.map((r) => ({
//             id: r._id,
//             appointmentId: r.appointmentId,
//             duration: r.audio?.duration
//                 ? `${Math.floor(r.audio.duration / 60)
//                     .toString()
//                     .padStart(2, "0")}:${(r.audio.duration % 60)
//                         .toString()
//                         .padStart(2, "0")}`
//                 : "00:00",
//             date: r.metadata?.recordedAt
//                 ? new Date(r.metadata.recordedAt).toISOString().split("T")[0]
//                 : new Date(r.createdAt).toISOString().split("T")[0],
//             analyzed: r.analysis?.status === "completed",
//             spinScore: r.analysis?.spin?.overall?.score || null,
//             sentiment: r.analysis?.sentiment?.overall || null,
//             fileUrl: r.audio?.fileUrl || null,
//             transcriptionUrl: r.audio?.transcriptionUrl || null,
//         }));

//         res.status(200).json({
//             success: true,
//             message: "All recordings retrieved successfully.",
//             data: formatted,
//         });
//     } catch (error) {
//         console.error("Get recordings error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

/**
 * @desc Get detailed analysis for a specific recording
 * @route GET /api/recordings/:id/analysis
 * @access Private
 */
export const getRecordingAnalysis = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const recording = await Recording.findOne({ _id: id, userId });

        if (!recording) {
            return res.status(404).json({
                success: false,
                message: "Recording not found or you don't have access to it",
            });
        }

        if (recording.analysis?.status !== "completed") {
            return res.status(200).json({
                success: true,
                data: {
                    recordingId: recording._id,
                    analyzed: false,
                    status: recording.analysis?.status || "pending",
                    message: "Analysis is not yet completed",
                },
            });
        }

        const analysisData = {
            recordingId: recording._id,
            analyzed: true,
            spinScore: recording.analysis?.spin?.overall?.score || 0,
            sentiment: recording.analysis?.sentiment?.overall || "neutral",
            sentimentScore: recording.analysis?.sentiment?.score || 0,
            transcription: recording.analysis?.transcription || "",
            spinAnalysis: {
                situation: {
                    score: recording.analysis?.spin?.situation?.score || 0,
                    count: recording.analysis?.spin?.situation?.count || 0,
                    examples: recording.analysis?.spin?.situation?.examples || [],
                },
                problem: {
                    score: recording.analysis?.spin?.problem?.score || 0,
                    count: recording.analysis?.spin?.problem?.count || 0,
                    examples: recording.analysis?.spin?.problem?.examples || [],
                },
                implication: {
                    score: recording.analysis?.spin?.implication?.score || 0,
                    count: recording.analysis?.spin?.implication?.count || 0,
                    examples: recording.analysis?.spin?.implication?.examples || [],
                },
                needPayoff: {
                    score: recording.analysis?.spin?.needPayoff?.score || 0,
                    count: recording.analysis?.spin?.needPayoff?.count || 0,
                    examples: recording.analysis?.spin?.needPayoff?.examples || [],
                },
            },
            recommendations: recording.analysis?.spin?.overall?.recommendations || [],
            keyMoments: recording.analysis?.keyMoments || [],
        };

        res.status(200).json({
            success: true,
            data: analysisData,
        });
    } catch (error) {
        console.error("Get recording analysis error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const uploadRecordingToS3 = async (req, res) => {
    try {
        const userId = req.userId;
        const { appointmentId, metadata } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "File is required" });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(400).json({ success: false, message: "Invalid appointmentId" });
        }

        const parsedMetadata = metadata ? JSON.parse(metadata) : {};

        const s3 = await uploadBufferToS3(req.file);

        const recording = await Recording.create({
            userId,
            appointmentId,
            title: req.file.originalname,
            audio: {
                fileName: s3.fileName,
                fileUrl: s3.fileUrl,
                fileSize: s3.fileSize,
                duration: parsedMetadata.duration || 0,
                format: req.file.mimetype.split("/")[1],
            },
            metadata: {
                recordedAt: parsedMetadata.recordedAt || new Date(),
                deviceType: parsedMetadata.deviceType || "unknown",
                platform: parsedMetadata.platform || "unknown",
            },
            analysis: { status: "pending" },
        });

        res.status(201).json({
            success: true,
            message: "Uploaded to S3 successfully",
            data: recording,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

