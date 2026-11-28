const mongoose = require("mongoose");

const losReferenceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    package_name: { type: String, default: "" },
    los_days: { type: Number, default: null },
    los_display: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LosReference", losReferenceSchema);
