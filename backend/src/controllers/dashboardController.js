const pool = require("../config/database");

async function getUserDashboard(req, res) {
  try {
    const userId = req.user.id;

    const [
      investmentSummary,
      transactionSummary,
      referralSummary,
    ] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_investments,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_investments,
          COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_investments,
          COALESCE(
            SUM(amount) FILTER (WHERE status = 'APPROVED'),
            0
          ) AS total_invested,
          COALESCE(
            SUM(units) FILTER (WHERE status = 'APPROVED'),
            0
          ) AS total_units
        FROM buildvest_investments
        WHERE user_id = $1
        `,
        [userId]
      ),

      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful_transactions,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_transactions,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_transactions,
          COALESCE(
            SUM(amount) FILTER (WHERE status = 'SUCCESS'),
            0
          ) AS total_paid
        FROM buildvest_transactions
        WHERE user_id = $1
        `,
        [userId]
      ),

      pool.query(
        `
        SELECT
          COUNT(*) AS total_referrals,
          COUNT(*) FILTER (WHERE status = 'QUALIFIED') AS qualified_referrals,
          COUNT(*) FILTER (WHERE status = 'REWARDED') AS rewarded_referrals
        FROM buildvest_referrals
        WHERE referrer_id = $1
        `,
        [userId]
      ),
    ]);

    res.json({
      success: true,
      dashboard: {
        investments: investmentSummary.rows[0],
        transactions: transactionSummary.rows[0],
        referrals: referralSummary.rows[0],
      },
    });
  } catch (error) {
    console.error("Get user dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard",
    });
  }
}

module.exports = {
  getUserDashboard,
};