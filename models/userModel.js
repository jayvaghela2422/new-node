import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// 🔹 Embedded Schemas
const notificationPrefsSchema = new mongoose.Schema({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: false },
  sms: { type: Boolean, default: false },
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  notifications: { type: notificationPrefsSchema, default: () => ({}) },
  language: { type: String, default: "en" },
  timezone: { type: String, default: "UTC" },
}, { _id: false });

const statsSchema = new mongoose.Schema({
  totalRecordings: { type: Number, default: 0 },
  totalAppointments: { type: Number, default: 0 },
  avgSpinScore: { type: Number, default: 0 },
  totalCallDuration: { type: Number, default: 0 },
}, { _id: false });

// 🔹 Main Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  // firstName: { type: String, required: true },
  // lastName: { type: String, required: true },
  phone: { type: String, required: true },

  role: { type: String, enum: ["sales_rep", "manager", "admin"], default: "sales_rep", index: true },
  company: { type: String },
  department: { type: String },
  profileImage: { type: String },

  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },

  preferences: { type: preferencesSchema, default: () => ({}) },
  stats: { type: statsSchema, default: () => ({}) },
}, { timestamps: true });

// 🔹 Methods
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    company: this.company,
    department: this.department,
    profileImage: this.profileImage,
    isEmailVerified: this.isEmailVerified,
    isPhoneVerified: this.isPhoneVerified,
    isActive: this.isActive,
  };
};

// 🔹 Indexes
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model("User", userSchema);
export default User;
