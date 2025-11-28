import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from '../models/sessionModel.js';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected successfully");
        startSessionCleanup();
    } catch (error) {
        console.error("❌ Error connecting to MongoDB:", error.message);
        console.error("\n⚠️  IMPORTANT: If using MongoDB Atlas, you need to whitelist Replit's IP addresses:");
        console.error("   1. Go to your MongoDB Atlas cluster");
        console.error("   2. Navigate to Network Access");
        console.error("   3. Add IP Address: 0.0.0.0/0 (allow access from anywhere)");
        console.error("   4. Or add specific Replit IP ranges for better security\n");
        console.error("⚠️  Server will continue running but database operations will fail until connected.\n");
    }
};

const startSessionCleanup = () => {
    console.log("🔄 Session cleanup scheduler started (runs every 30 seconds)");
    
    const cleanupInterval = setInterval(async () => {
        try {
            if (!Session || typeof Session.updateMany !== 'function') {
                console.error("❌ Session model not properly initialized");
                clearInterval(cleanupInterval);
                return;
            }

            const now = new Date();

            const result = await Session.updateMany(
                { 
                    isActive: true,
                    expiresAt: { $lt: now }
                },
                { 
                    $set: { isActive: false } 
                }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`⏰ Revoked ${result.modifiedCount} expired session(s) at ${now.toISOString()}`);
            }
        } catch (error) {
            console.error("❌ Session cleanup error:", error.message);
        }
    }, 30000);

    process.on('SIGINT', () => {
        clearInterval(cleanupInterval);
        process.exit(0);
    });
};

export default connectDB;
