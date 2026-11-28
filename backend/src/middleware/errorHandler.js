const config = require("../config/env");

function notFound(req, res) {
  res.status(404).json({ error: "Endpoint not found" });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message =
    config.nodeEnv === "production" && status === 500
      ? "Internal server error"
      : err.message || "Unexpected server error";

  if (status >= 500) {
    console.error(`[Error ${status}] ${req.method} ${req.originalUrl}:`, err.message);
  }
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
