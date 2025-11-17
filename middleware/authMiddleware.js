import jwt from "jsonwebtoken";
import Session from "../models/sessionModel.js";

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.token = token;

    const session = await Session.findOne({ token, userId: decoded.userId });
    if (session) {
      if (!session.isActive) {
        return res.status(401).json({ 
          success: false, 
          message: "Session has been revoked. Please login again." 
        });
      }
      if (session.isExpired()) {
        await session.revoke();
        return res.status(401).json({ 
          success: false, 
          message: "Session expired. Please login again." 
        });
      }

      await session.updateActivity();
    }

    next();
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

export default authMiddleware;
