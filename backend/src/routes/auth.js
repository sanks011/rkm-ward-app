const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { getDbStatus } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    if (getDbStatus() !== "connected") {
      return res.status(503).json({ error: "Database unavailable. Please try again." });
    }

    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      {
        sub: String(user._id),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        is_admin: !!user.is_admin
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    return res.status(200).json({
      token,
      user: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        is_admin: !!user.is_admin,
        designation: user.designation,
        reg_no: user.reg_no
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash").lean();
    if (!user) {
      return res.status(200).json({ user: req.user });
    }
    return res.status(200).json({
      user: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        is_admin: !!user.is_admin,
        designation: user.designation,
        reg_no: user.reg_no
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/register (Admin only)
router.post("/register", requireAuth, async (req, res, next) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: "Admin access required to create users." });
    }
    const { email, password, fullName, role, is_admin, designation, reg_no } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "email, password, and fullName are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "A user with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await User.create({
      email: normalizedEmail,
      passwordHash,
      fullName: String(fullName).trim(),
      role: ["admin", "doctor", "staff"].includes(role) ? role : "doctor",
      is_admin: !!is_admin,
      designation: designation || "",
      reg_no: reg_no || ""
    });

    return res.status(201).json({
      user: {
        id: String(created._id),
        email: created.email,
        fullName: created.fullName,
        role: created.role,
        is_admin: created.is_admin
      }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
