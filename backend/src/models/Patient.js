const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    mrd: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    pmjay_id: { type: String, default: null },
    ward: { type: String, default: "", index: true },
    bed_no: { type: String, default: "" },
    doctor_unit: { type: String, default: null },
    admission_date: { type: String, default: null },
    patient_category: { type: String, default: "Medicine", index: true },
    los_days: { type: Number, default: null },
    los_start_date: { type: String, default: null },
    is_discharged: { type: Boolean, default: false, index: true },
    discharged_date: { type: String, default: null },
    sex: { type: String, default: null },
    dob: { type: String, default: null },
    gestational_age: { type: String, default: null },
    birth_weight: { type: String, default: null },
    admission_weight: { type: String, default: null },
    age_text: { type: String, default: null },
    supabase_created_at: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
