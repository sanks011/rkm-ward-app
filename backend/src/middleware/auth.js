const jwt = require("jsonwebtoken");
const config = require("../config/env");

/**
 * Verifies MongoDB-issued JWT Bearer tokens (primary), with Supabase JWT fallback.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }

    // 1. Primary: Verify our Express/MongoDB JWT
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        fullName: decoded.fullName || "",
        role: decoded.role || "doctor",
        is_admin: !!decoded.is_admin,
        token
      };
      return next();
    } catch {
      // Not our JWT; try Supabase fallback if configured
    }

    if (config.supabaseUrl && config.supabaseKey) {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.email,
          role: "doctor",
          is_admin: false,
          token
        };
        return next();
      }
    }

    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  } catch (err) {
    return res.status(502).json({ error: "Could not verify authentication: " + err.message });
  }
}

module.exports = { requireAuth };
