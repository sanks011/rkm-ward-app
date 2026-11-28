const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { sortClinicalText } = require("../services/claudeService");

const router = express.Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const text = String((req.body && req.body.text) || "").slice(0, 12000);
    if (!text.trim()) {
      return res.status(400).json({ error: "No text received" });
    }
    const chart = req.body && req.body.chart === "adult" ? "adult" : "nicu";
    const field = String((req.body && req.body.field) || "");

    const t0 = Date.now();
    const fields = await sortClinicalText(text, chart, field);
    return res.status(200).json({
      fields,
      ms: { sort: ((Date.now() - t0) / 1000).toFixed(1) }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
