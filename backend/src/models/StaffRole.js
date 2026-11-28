const mongoose = require("mongoose");

const staffRoleSchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    user_id: { type: String, required: true, unique: true, index: true },
    is_admin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffRole", staffRoleSchema);
