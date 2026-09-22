const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const profileResult = await pool.query(
      `
      SELECT
        account_status
      FROM buildvest_user_profiles
      WHERE user_id = $1
      `,
      [decoded.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "BuildVest account not found",
      });
    }

    const profile = profileResult.rows[0];

    if (profile.account_status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "BuildVest account is suspended",
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication service error",
    });
  }
}

module.exports = authenticateToken;