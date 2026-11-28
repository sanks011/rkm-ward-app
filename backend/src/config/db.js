const mongoose = require("mongoose");
const config = require("./env");

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (!config.mongoUri) {
    console.warn("[MongoDB] MONGO_URI not configured; running without MongoDB persistence.");
    return null;
  }

  try {
    await mongoose.connect(config.mongoUri, {
      dbName: config.mongoDbName,
      serverSelectionTimeoutMS: 10000
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database "${config.mongoDbName}"`);
    return mongoose.connection;
  } catch (err) {
    console.error("[MongoDB] Connection error:", err.message);
    return null;
  }
}

function getDbStatus() {
  const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  return states[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDB, getDbStatus };
