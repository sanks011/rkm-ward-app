const mongoose = require("mongoose");

const wardHistorySchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    mrd: { type: String, required: true, index: true },
    old_ward: { type: String, default: "" },
    old_bed: { type: String, default: "" },
    new_ward: { type: String, default: "" },
    new_bed: { type: String, default: "" },
    changed_by: { type: String, default: "" },
    changed_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("WardHistory", wardHistorySchema);
