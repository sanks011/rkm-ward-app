const mongoose = require("mongoose");

// Stores metadata & Supabase Storage URL path ONLY (no raw binary bits in DB)
const dailyPhotoSchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    mrd: { type: String, required: true, index: true },
    photo_date: { type: String, required: true, index: true },
    photo_type: { type: String, required: true, index: true },
    photo_url: { type: String, default: "" },
    file_type: { type: String, default: "pdf" },
    geo_location: { type: String, default: "" },
    uploaded_by: { type: String, default: "" },
    uploaded_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

dailyPhotoSchema.index({ mrd: 1, photo_date: 1, photo_type: 1 });

module.exports = mongoose.model("DailyPhoto", dailyPhotoSchema);
