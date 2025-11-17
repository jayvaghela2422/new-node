import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import Session from "../models/sessionModel.js";
import {
  generateVerificationCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/emailService.js";

export const registerUser = async (req, res) => {
  const { name, email, phone, password, role, company, department } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !phone || !password)
      return res.status(400).json({ success: false, message: "All required fields must be provided" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 6);
    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || "sales_rep",
      company,
      department,
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
    });

    //Generate OTP for email verification
    const code = OTP.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.create({
      email,
      type: "email_verification",
      code,
      expiresAt,
    });

    //Send OTP email
    const emailResult = await sendVerificationEmail(email, code, name);
    if (!emailResult.success) {
      console.error('Email sending failed during registration:', emailResult);
      return res.status(500).json({
        success: false,
        message: "User registered but failed to send verification email",
        error: emailResult.error || "Failed to send verification email",
        details: emailResult.details,
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email.",
      data: {
        userId: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        requiresOTP: true,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password",
        field: "email"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false, 
        message: "Invalid email or password",
        field: "password"
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in",
        emailVerified: false,
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Create session record
    const session = await Session.create({
      userId: user._id,
      token,
      deviceInfo: {
        deviceType: req.body.deviceType || "unknown",
        platform: req.body.platform || "web",
        appVersion: req.body.appVersion,
        osVersion: req.body.osVersion,
        deviceModel: req.body.deviceModel,
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      isActive: true,
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user._id,
        email: user.email,
        requiresOTP: false,
        sessionId: session._id,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  const { userId, otp } = req.body;

  try {
    //Validate
    if (!userId || !otp)
      return res.status(400).json({ success: false, message: "User ID and OTP are required" });

    //Find user
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.isEmailVerified)
      return res.status(400).json({ success: false, message: "Email already verified" });

    //Find OTP entry
    const otpRecord = await OTP.findOne({ email: user.email, type: "email_verification" })
      .sort({ createdAt: -1 });

    if (!otpRecord)
      return res.status(404).json({ success: false, message: "No OTP found or expired" });

    if (otpRecord.isUsed)
      return res.status(400).json({ success: false, message: "OTP already used" });

    if (new Date() > otpRecord.expiresAt)
      return res.status(400).json({ success: false, message: "OTP expired" });

    otpRecord.attempts += 1;

    if (otpRecord.code !== otp) {
      await otpRecord.save();
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    //OTP is valid
    otpRecord.isUsed = true;
    await otpRecord.save();

    user.isEmailVerified = true;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Create session record
    const session = await Session.create({
      userId: user._id,
      token,
      deviceInfo: {
        deviceType: req.body.deviceType || "unknown",
        platform: req.body.platform || "web",
        appVersion: req.body.appVersion,
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        sessionId: session._id,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    //Validate
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.isEmailVerified)
      return res.status(400).json({ success: false, message: "Email already verified" });

    //Invalidate previous OTPs
    await OTP.updateMany(
      { email, type: "email_verification", isUsed: false },
      { $set: { isUsed: true } }
    );

    //Create a new OTP
    const code = OTP.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.create({
      email,
      type: "email_verification",
      code,
      expiresAt,
    });

    //Send email
    const emailResult = await sendVerificationEmail(email, code, user.name);
    if (!emailResult.success)
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
        error: emailResult.error,
      });

    res.status(200).json({
      success: true,
      message: "Verification code sent successfully. Please check your email.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Map your internal DB stats fields to the desired response format
    const stats = {
      totalCalls: user.stats?.totalRecordings || 0,
      avgSpinScore: user.stats?.avgSpinScore || 0,
      totalAppointments: user.stats?.totalAppointments || 0,
    };

    res.status(200).json({
      success: true,
      message: "User profile retrieved successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "sales_rep",
        phone: user.phone,
        joinedDate: user.createdAt.toISOString().split("T")[0], // YYYY-MM-DD
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    //Invalidate old OTPs
    await OTP.deleteMany({ email, type: "password_reset" });

    //Create new OTP record
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.create({
      email,
      code,
      type: "password_reset",
      isUsed: false,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
    });

    //Send email
    const emailResult = await sendPasswordResetEmail(email, code, user.name);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email",
        error: emailResult.error,
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset code sent successfully. Please check your email.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code, and new password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Find valid OTP
    const otp = await OTP.findOne({ email, code, type: "password_reset" });

    if (!otp) {
      return res.status(400).json({ success: false, message: "Invalid or expired code" });
    }

    // ✅ Check expiration
    if (new Date() > otp.expiresAt) {
      return res.status(400).json({ success: false, message: "Code has expired" });
    }

    // ✅ Check attempt limit
    if (otp.attempts >= otp.maxAttempts) {
      return res.status(400).json({ success: false, message: "Maximum attempts reached" });
    }

    // ✅ Verify code
    if (otp.code !== code) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({ success: false, message: "Invalid code" });
    }

    // ✅ Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 6);
    user.password = hashedPassword;
    await user.save();

    // ✅ Mark OTP as used
    otp.isUsed = true;
    await otp.save();

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      const session = await Session.findOne({ token, isActive: true });
      if (session) {
        await session.revoke();
      }
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    // ✅ Find the logged-in user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Update only the provided fields
    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    // ✅ Response
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc Get all active sessions for the authenticated user
 * @route GET /api/auth/sessions
 * @access Private
 */
export const getUserSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const currentToken = req.token;

    const sessions = await Session.find({ userId, isActive: true })
      .sort({ lastActivity: -1 });

    const formatted = sessions.map((session) => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === currentToken,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc Revoke all sessions except current one
 * @route POST /api/auth/revoke-sessions
 * @access Private
 */
export const revokeAllSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const currentToken = req.token;

    await Session.updateMany(
      { userId, isActive: true, token: { $ne: currentToken } },
      { $set: { isActive: false } }
    );

    res.status(200).json({
      success: true,
      message: "All other sessions have been revoked",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
