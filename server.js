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

// CORS: allow frontend apps on localhost:3000 and localhost:8081
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081'],
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


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
