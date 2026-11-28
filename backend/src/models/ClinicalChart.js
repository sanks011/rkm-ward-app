const mongoose = require("mongoose");

const clinicalChartSchema = new mongoose.Schema(
  {
    supabase_id: { type: Number, index: true, sparse: true },
    mrd: { type: String, required: true, index: true },
    chart_date: { type: String, required: true, index: true },
    chart_type: { type: String, enum: ["nicu", "adult"], default: "nicu" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    raw_dictation: { type: String, default: "" },
    signed_by: { type: String, default: null },
    author_email: { type: String, default: "" },
    pdf_storage_path: { type: String, default: "" }
  },
  { timestamps: true }
);

clinicalChartSchema.index({ mrd: 1, chart_date: -1 });

module.exports = mongoose.model("ClinicalChart", clinicalChartSchema);
