const pool = require("../config/database");

async function createReferral(req, res) {
  try {
    const referrerId = req.user.id;
    const { referred_user_id } = req.body;

    if (!referred_user_id) {
      return res.status(400).json({
        success: false,
        message: "Referred user ID is required",
      });
    }

    if (referrerId === referred_user_id) {
      return res.status(400).json({
        success: false,
        message: "A user cannot refer themselves",
      });
    }

    const referredUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      `,
      [referred_user_id]
    );

    if (referredUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Referred user not found",
      });
    }

    const existingReferral = await pool.query(
      `
      SELECT id
      FROM buildvest_referrals
      WHERE referrer_id = $1
        AND referred_user_id = $2
      `,
      [referrerId, referred_user_id]
    );

    if (existingReferral.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Referral already exists",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO buildvest_referrals (
        referrer_id,
        referred_user_id,
        status
      )
      VALUES ($1, $2, 'REGISTERED')
      RETURNING
        id,
        referrer_id,
        referred_user_id,
        status,
        created_at
      `,
      [referrerId, referred_user_id]
    );

    res.status(201).json({
      success: true,
      message: "Referral created successfully",
      referral: result.rows[0],
    });
  } catch (error) {
    console.error("Create referral error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create referral",
    });
  }
}

async function getMyReferrals(req, res) {
  try {
    const referrerId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.referred_user_id,
        u.full_name AS referred_user_name,
        u.email AS referred_user_email,
        r.status,
        r.created_at
      FROM buildvest_referrals r
      INNER JOIN users u
        ON u.id = r.referred_user_id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC
      `,
      [referrerId]
    );

    res.json({
      success: true,
      referrals: result.rows,
    });
  } catch (error) {
    console.error("Get my referrals error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve referrals",
    });
  }
}

async function getAllReferrals(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.referrer_id,
        ref.full_name AS referrer_name,
        ref.email AS referrer_email,
        r.referred_user_id,
        referred.full_name AS referred_user_name,
        referred.email AS referred_user_email,
        r.status,
        r.created_at
      FROM buildvest_referrals r
      INNER JOIN users ref
        ON ref.id = r.referrer_id
      INNER JOIN users referred
        ON referred.id = r.referred_user_id
      ORDER BY r.created_at DESC
    `);

    res.json({
      success: true,
      referrals: result.rows,
    });
  } catch (error) {
    console.error("Get all referrals error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve referrals",
    });
  }
}

async function updateReferralStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "REGISTERED",
      "QUALIFIED",
      "REWARDED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral status",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_referrals
      SET status = $1
      WHERE id = $2
      RETURNING
        id,
        referrer_id,
        referred_user_id,
        status,
        created_at
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Referral not found",
      });
    }

    res.json({
      success: true,
      message: "Referral status updated successfully",
      referral: result.rows[0],
    });
  } catch (error) {
    console.error("Update referral status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update referral status",
    });
  }
}

module.exports = {
  createReferral,
  getMyReferrals,
  getAllReferrals,
  updateReferralStatus,
};