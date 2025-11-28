import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { getUserProfile } from "./controllers/authController.js";
import { updateProfile } from "./controllers/authController.js";
import authMiddleware from "./middleware/authMiddleware.js";
import firefliesRoutes from "./routes/firefliesRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import recordingRoutes from "./routes/recordingRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// CORS: allow all origins for Replit environment
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

connectDB();

app.use("/api/auth", authRoutes);
app.get("/api/profile", authMiddleware, getUserProfile);
app.put("/api/profile", authMiddleware, updateProfile);
app.use("/api/fireflies", firefliesRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/recordings", recordingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);


const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Set server timeout (default: 10 minutes, configurable via env)
const serverTimeout = parseInt(process.env.SERVER_TIMEOUT) || 600000; // 10 minutes in milliseconds
server.timeout = serverTimeout;
server.keepAliveTimeout = 65000; // Keep-alive timeout
server.headersTimeout = 66000; // Headers timeout (should be > keepAliveTimeout)

console.log(`Server timeout set to ${serverTimeout / 1000} seconds`);
