require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || "",
  deepgramModel: process.env.DEEPGRAM_MODEL || "nova-3",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_KEY || "",
  mongoUri: process.env.MONGO_URI || "",
  mongoDbName: process.env.MONGO_DB_NAME || "rkmsp_ward",
  jwtSecret: process.env.JWT_SECRET || "rkmsp_dev_jwt_secret_change_me"
};
