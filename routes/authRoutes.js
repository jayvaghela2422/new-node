import { Router } from "express";
import { 
  loginUser, 
  registerUser, 
  getUserProfile, 
  logoutUser,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  updateProfile,
  getUserSessions,
  revokeAllSessions
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const routes = Router();

routes.post("/register", registerUser);
routes.post("/login", loginUser);
routes.post("/verify-otp", verifyEmail);
routes.post("/resend-verification", resendVerificationCode);
routes.post("/forgot-password", forgotPassword);
routes.post("/reset-password", resetPassword);

//routes.get("/profile", authMiddleware, getUserProfile);
//routes.put("/update-profile", authMiddleware, updateProfile);
routes.post("/logout", authMiddleware, logoutUser);

// Session management
routes.get("/sessions", authMiddleware, getUserSessions);
routes.post("/revoke-sessions", authMiddleware, revokeAllSessions);

export default routes;
