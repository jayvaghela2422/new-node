import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";
import { sendAppointmentNotification } from "../utils/emailService.js";

export const createAppointment = async (req, res) => {
    try {
        const { clientName, company, date, time, type, notes } = req.body;

        // Validation
        if (!clientName || !company || !date || !time || !type) {
            return res.status(400).json({
                success: false,
                message: "All required fields (clientName, company, date, time, type) must be provided",
            });
        }

        const parsedDate = new Date(`${date} ${time}`);
        if (isNaN(parsedDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date or time format.",
            });
        }

        const newAppointment = new Appointment({
            userId: req.userId,
            client: { name: clientName, company },
            scheduledDate: parsedDate,
            type,
            notes,
            status: "scheduled",
        });

        await newAppointment.save();

        // Send email notification
        try {
            const user = await User.findById(req.userId);
            if (user && user.email) {
                await sendAppointmentNotification(
                    newAppointment,
                    user.email,
                    user.name
                );
            }
        } catch (emailError) {
            console.error('Failed to send appointment notification:', emailError);
        }

        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            data: {
                id: newAppointment._id,
                clientName: newAppointment.client.name,
                company: newAppointment.client.company,
                date: newAppointment.scheduledDate.toISOString().split("T")[0],
                time: newAppointment.scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: newAppointment.status,
                type: newAppointment.type,
                notes: newAppointment.notes,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Update Appointment
export const updateAppointment = async (req, res) => {
    try {
        const { id } = req.params; // Appointment ID from URL
        const { status, notes } = req.body;

        if (!status && !notes) {
            return res.status(400).json({
                success: false,
                message: "No fields provided to update",
            });
        }

        // ✅ Find and update
        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found",
            });
        }

        // ✅ Update only the provided fields
        if (status) appointment.status = status;
        if (notes) appointment.notes = notes;

        await appointment.save();

        res.status(200).json({
            success: true,
            message: "Appointment updated successfully",
            data: {
                id: appointment._id,
                status: appointment.status,
                notes: appointment.notes,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Get Appointment by ID
export const getAppointmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const appointment = await Appointment.findById(id).populate("userId", "name email");

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Appointment details fetched successfully",
            data: {
                id: appointment._id,
                clientName: appointment.client.name,
                company: appointment.client.company,
                date: appointment.scheduledDate.toISOString().split("T")[0],
                time: appointment.scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: appointment.status,
                type: appointment.type,
                notes: appointment.notes,
                createdBy: {
                    name: `${appointment.userId.name}`,
                    email: appointment.userId.email,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Get All Appointments for Authenticated User
export const getAllAppointments = async (req, res) => {
    try {
        const userId = req.userId;
        const { status, date, limit = 50, offset = 0 } = req.query;

        const filter = { userId };
        if (status) filter.status = status;
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            filter.scheduledDate = { $gte: start, $lte: end };
        }

        const appointments = await Appointment.find(filter)
            .sort({ scheduledDate: 1 })
            .skip(Number(offset))
            .limit(Number(limit));

        const formatted = appointments.map((appt) => ({
            id: appt._id,
            clientName: appt.client.name,
            company: appt.client.company,
            date: appt.scheduledDate.toISOString().split("T")[0],
            time: appt.scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: appt.status,
            type: appt.type,
            notes: appt.notes,
        }));

        res.status(200).json({
            success: true,
            data: formatted,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



