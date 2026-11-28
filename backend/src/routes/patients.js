const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getDbStatus } = require("../config/db");
const Patient = require("../models/Patient");

const router = express.Router();

// Sync / upsert text patient data into MongoDB
router.post("/sync", requireAuth, async (req, res, next) => {
  try {
    if (getDbStatus() !== "connected") {
      return res.status(200).json({ synced: false });
    }
    const p = req.body;
    if (!p || !p.mrd) return res.status(400).json({ error: "mrd required" });

    await Patient.findOneAndUpdate(
      { mrd: String(p.mrd) },
      { $set: p },
      { upsert: true, new: true }
    );
    return res.status(200).json({ synced: true });
  } catch (err) {
    return next(err);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (getDbStatus() !== "connected") {
      return res.status(200).json({ patients: [] });
    }
    const patients = await Patient.find({}).sort({ is_discharged: 1, name: 1 }).lean();
    return res.status(200).json({ patients });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
