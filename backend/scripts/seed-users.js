/**
 * Seed Script: Creates default hospital staff & admin users in MongoDB.
 * Usage: cd backend && npm run seed:users (or node scripts/seed-users.js)
 */
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");
const User = require("../src/models/User");

const DEFAULT_USERS = [
  {
    email: "admin@rkmsp.org",
    password: "Rkmsp@2026",
    fullName: "RKMSP Admin",
    role: "admin",
    is_admin: true,
    designation: "Medical Superintendent / Admin",
    reg_no: ""
  },
  {
    email: "doctor@rkmsp.org",
    password: "Doctor@2026",
    fullName: "Dr. Attending Physician",
    role: "doctor",
    is_admin: false,
    designation: "RMO / Ward Physician",
    reg_no: ""
  },
  {
    email: "sarbajitr@kmapp.com",
    password: "Rkmsp@2026",
    fullName: "Dr. Sarbajit R",
    role: "admin",
    is_admin: true,
    designation: "Consultant",
    reg_no: ""
  }
];

async function seed() {
  const conn = await connectDB();
  if (!conn) {
    console.error("[Seed] Could not connect to MongoDB.");
    process.exit(1);
  }

  for (const u of DEFAULT_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.findOneAndUpdate(
      { email: u.email.toLowerCase() },
      {
        $set: {
          email: u.email.toLowerCase(),
          passwordHash,
          fullName: u.fullName,
          role: u.role,
          is_admin: u.is_admin,
          designation: u.designation,
          reg_no: u.reg_no,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Upserted user: ${u.email} (admin=${u.is_admin})`);
  }

  await mongoose.disconnect();
  console.log("[Seed] Done.");
}

seed().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
