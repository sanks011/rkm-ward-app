const config = require("../config/env");

/**
 * Verifies the doctor's Supabase JWT Bearer token before allowing access
 * to protected AI, transcription, and patient database endpoints.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "Authentication required. Please log in." });
    }

    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    const user = await response.json();
    req.user = {
      id: user.id,
      email: user.email,
      token
    };
    return next();
  } catch (err) {
    return res.status(502).json({ error: "Could not verify authentication: " + err.message });
  }
}

module.exports = { requireAuth };
