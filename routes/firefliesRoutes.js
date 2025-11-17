import { Router } from "express";
// import {
//     uploadRecording,
//     getRecordings,
// } from "../controllers/firefliesController.js";
import {
    uploadRecording,
    getRecordings,
    getUserRecordings,
    getFirefliesRecordingAnalysis,
} from "../controllers/firefliesController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Protected endpoints
router.post("/upload", authMiddleware, uploadRecording);
router.get("/recordings", authMiddleware, getRecordings);
router.get("/my-recordings", authMiddleware, getUserRecordings);
router.get('/recordings/:id/analysis', authMiddleware, getFirefliesRecordingAnalysis);

export default router;
