/**
 * RKMSP Clinical Suite - Node.js Server
 * Serves static clinical modules & handles AI Speech-to-Text & Claude Scribe APIs.
 */
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser with support for base64 audio and PDF uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logger for API calls
app.use((req, res, next) => {
  if (req.url.startsWith("/api/")) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// API Routes
app.all("/api/transcribe", require("./api/transcribe.js"));
app.all("/api/sort", require("./api/sort.js"));
app.all("/api/health", require("./api/health.js"));

// Serve static assets & root HTML files
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, ".")));

// Friendly route aliases
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/ward", (req, res) => res.sendFile(path.join(__dirname, "ward.html")));
app.get("/patients", (req, res) => res.sendFile(path.join(__dirname, "patient-list.html")));
app.get("/patient", (req, res) => res.sendFile(path.join(__dirname, "patient.html")));
app.get("/clinical-notes", (req, res) => res.sendFile(path.join(__dirname, "clinical-note.html")));
app.get("/nicu", (req, res) => res.sendFile(path.join(__dirname, "clinical-note.html")));
app.get("/icon-:file", (req, res) => res.sendFile(path.join(__dirname, "public/assets/icons", "icon-" + req.params.file)));

app.listen(PORT, () => {
  console.log("==================================================");
  console.log(`  RKMSP Clinical Suite Server running on port ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Anthropic Model: ${process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"}`);
  console.log(`  Deepgram Model:  ${process.env.DEEPGRAM_MODEL || "nova-3"}`);
  console.log("==================================================");
});
