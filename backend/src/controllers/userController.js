const pool = require("../config/database");

async function getBuildVestUsers(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        bp.account_status AS buildvest_account_status,
bp.verification_status AS buildvest_verification_status,
(bp.verification_status = 'VERIFIED') AS is_verified,
        bp.created_at AS buildvest_joined_at
      FROM buildvest_user_profiles bp
      INNER JOIN users u
        ON u.id = bp.user_id
      ORDER BY bp.created_at DESC
    `);

    res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("Get BuildVest users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve BuildVest users",
    });
  }
}

async function updateBuildVestUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { account_status } = req.body;

    const allowedStatuses = [
      "ACTIVE",
      "SUSPENDED",
    ];

    if (!allowedStatuses.includes(account_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid BuildVest account status",
      });
    }

    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_user_profiles
      SET account_status = $1
      WHERE user_id = $2
      RETURNING
        user_id,
        account_status
      `,
      [account_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "BuildVest user not found",
      });
    }

    res.json({
      success: true,
      message: "BuildVest user status updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update BuildVest user status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update BuildVest user status",
    });
  }
}

async function updateBuildVestUserVerification(req, res) {
  try {
    const { id } = req.params;
    const { verification_status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "VERIFIED",
      "REJECTED",
    ];

    if (!allowedStatuses.includes(verification_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid BuildVest verification status",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_user_profiles
      SET verification_status = $1
      WHERE user_id = $2
      RETURNING
        user_id,
        verification_status
      `,
      [verification_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "BuildVest user not found",
      });
    }

    res.json({
      success: true,
      message: "BuildVest verification status updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Update BuildVest verification error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update BuildVest verification status",
    });
  }
}

async function getMyBuildVestProfile(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
       bp.account_status AS buildvest_account_status,
bp.verification_status AS buildvest_verification_status,
(bp.verification_status = 'VERIFIED') AS is_verified,
        bp.created_at AS buildvest_joined_at
      FROM buildvest_user_profiles bp
      INNER JOIN users u
        ON u.id = bp.user_id
      WHERE bp.user_id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "BuildVest profile not found",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Get my BuildVest profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve BuildVest profile",
    });
  }
}

module.exports = {
  getBuildVestUsers,
  updateBuildVestUserStatus,
  getMyBuildVestProfile,
  updateBuildVestUserVerification,
};