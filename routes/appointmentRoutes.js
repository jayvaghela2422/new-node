import { Router } from "express";
import { createAppointment, updateAppointment, getAppointmentById, getAllAppointments, } from "../controllers/appointmentController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Protected route: Only logged-in users can create an appointment
router.post("/", authMiddleware, createAppointment);
router.put("/:id", authMiddleware, updateAppointment);
router.get("/:id", authMiddleware, getAppointmentById);
router.get("/", authMiddleware, getAllAppointments);

export default router;
