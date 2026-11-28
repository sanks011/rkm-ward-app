const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getDbStatus } = require("../config/db");
const ClinicalChart = require("../models/ClinicalChart");
const DailyPhoto = require("../models/DailyPhoto");

const router = express.Router();

// Saves structured clinical round note text into MongoDB (alongside Supabase)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (getDbStatus() !== "connected") {
      return res.status(200).json({ savedToMongo: false, reason: "MongoDB disconnected" });
    }

    const { mrd, chart_date, chart_type, data, raw_dictation, signed_by, pdf_storage_path } = req.body || {};
    if (!mrd || !chart_date) {
      return res.status(400).json({ error: "mrd and chart_date are required" });
    }

    const doc = await ClinicalChart.create({
      mrd: String(mrd),
      chart_date,
      chart_type: chart_type === "adult" ? "adult" : "nicu",
      data: data || {},
      raw_dictation: raw_dictation || "",
      signed_by: signed_by || null,
      author_email: req.user.email || "",
      pdf_storage_path: pdf_storage_path || ""
    });

    if (pdf_storage_path) {
      await DailyPhoto.create({
        mrd: String(mrd),
        photo_date: chart_date,
        photo_type: "IPD Chart",
        photo_url: pdf_storage_path,
        file_type: "pdf",
        geo_location: "",
        uploaded_by: req.user.email || "",
        uploaded_at: new Date()
      });
    }

    return res.status(201).json({ savedToMongo: true, id: doc._id });
  } catch (err) {
    return next(err);
  }
});

router.get("/:mrd", requireAuth, async (req, res, next) => {
  try {
    if (getDbStatus() !== "connected") {
      return res.status(200).json({ charts: [] });
    }
    const charts = await ClinicalChart.find({ mrd: String(req.params.mrd) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ charts });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
