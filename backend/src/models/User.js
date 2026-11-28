const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ["admin", "doctor", "staff"], default: "doctor" },
    is_admin: { type: Boolean, default: false },
    designation: { type: String, default: "" },
    reg_no: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
