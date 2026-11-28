const mongoose = require("mongoose");

const enhancementLogSchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    mrd: { type: String, required: true, index: true },
    marked_by: { type: String, default: "" },
    marked_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("EnhancementLog", enhancementLogSchema);
