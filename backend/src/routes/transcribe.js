const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { transcribeAudio } = require("../services/sttService");
const { sortClinicalText } = require("../services/claudeService");

const router = express.Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b64 = String((req.body && req.body.audio) || "");
    if (!b64 || b64.length > 8000000) {
      return res.status(400).json({ error: "Audio missing or too long (max ~4 minutes)." });
    }

    const mime = String((req.body && req.body.mime) || "audio/webm").split(";")[0];
    const chart = req.body && req.body.chart === "adult" ? "adult" : "nicu";
    const language = String((req.body && req.body.language) || "multi");

    const tA = Date.now();
    const stt = await transcribeAudio({ audioBase64: b64, mime, chart, language });
    const tB = Date.now();

    const out = {
      text: stt.text,
      detectedLanguage: stt.detectedLanguage,
      confidence: stt.confidence
    };

    if (req.body.sort && stt.text.trim()) {
      try {
        const field = String(req.body.field || "");
        const prior = field ? "" : String(req.body.prior || "").slice(0, 8000);
        const combined = (prior ? prior + " " : "") + stt.text;
        out.fields = await sortClinicalText(combined, chart, field);
      } catch (e) {
        out.sortError = e.message;
      }
    }

    out.ms = {
      stt: ((tB - tA) / 1000).toFixed(1),
      sort: ((Date.now() - tB) / 1000).toFixed(1)
    };

    return res.status(200).json(out);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
