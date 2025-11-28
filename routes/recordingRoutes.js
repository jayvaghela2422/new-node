import { Router } from "express";
import { uploadRecording, upload, getAllRecordings, getRecordingAnalysis, uploadRecordingToS3 } from "../controllers/recordingController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/recordings/upload
router.post("/upload", authMiddleware, upload.single("file"), uploadRecording);

// S3 upload
router.post("/upload-to-s3", authMiddleware, upload.single("file"), uploadRecordingToS3);

// get all recordings
router.get("/", authMiddleware, getAllRecordings);
// GET /api/recordings/:id/analysis
router.get("/:id/analysis", authMiddleware, getRecordingAnalysis);

export default router;
