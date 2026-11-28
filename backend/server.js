/**
 * RKMSP Clinical Suite - Secure Express Backend
 * Handles Multilingual STT (Deepgram), Clinical Structuring (Claude AI),
 * MongoDB Text Persistence, and Security Middleware.
 */
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const config = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const app = express();

// Trust proxy headers when behind Nginx / Render / Railway / Vercel
app.set("trust proxy", 1);

// Security HTTP headers
app.use(helmet());

// Strict CORS configuration
const allowedOrigins = config.corsOrigin.split(",").map(s => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, or Next.js rewrite proxy (no origin) and allowed origins
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not permitted"));
    },
    credentials: true
  })
);

// Rate limiting on API routes to prevent abuse / API key drain
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." }
});

app.use("/api/", apiLimiter);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Request logging (no sensitive payloads logged for medical privacy)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use("/api/health", require("./src/routes/health"));
app.use("/api/transcribe", require("./src/routes/transcribe"));
app.use("/api/sort", require("./src/routes/sort"));
app.use("/api/charts", require("./src/routes/charts"));
app.use("/api/patients", require("./src/routes/patients"));

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log("==================================================");
    console.log(`  RKMSP Clinical Backend running on port ${config.port}`);
    console.log(`  Anthropic Model : ${config.anthropicModel}`);
    console.log(`  Deepgram Model  : ${config.deepgramModel}`);
    console.log(`  CORS Origin     : ${allowedOrigins.join(", ")}`);
    console.log("==================================================");
  });
}

start();
