require("dotenv").config();

module.exports = async (req, res) => {
  return res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      deepgramModel: process.env.DEEPGRAM_MODEL || "nova-3",
      supabase: !!process.env.SUPABASE_URL
    }
  });
};
