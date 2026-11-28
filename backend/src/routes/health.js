const express = require("express");
const config = require("../config/env");
const { getDbStatus } = require("../config/db");

const router = express.Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: getDbStatus(),
      anthropic: !!config.anthropicApiKey,
      anthropicModel: config.anthropicModel,
      deepgram: !!config.deepgramApiKey,
      deepgramModel: config.deepgramModel,
      supabase: !!config.supabaseUrl
    }
  });
});

module.exports = router;
