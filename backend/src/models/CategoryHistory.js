const mongoose = require("mongoose");

const categoryHistorySchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    mrd: { type: String, required: true, index: true },
    old_category: { type: String, default: "" },
    new_category: { type: String, default: "" },
    changed_by: { type: String, default: "" },
    changed_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CategoryHistory", categoryHistorySchema);
