const pool = require("../config/database");

async function getAdminDashboard(req, res) {
  try {
   const [
  userSummary,
  propertySummary,
  investmentSummary,
  transactionSummary,
  referralSummary,
  fundingSummary,
] = await Promise.all([
     pool.query(`
  SELECT
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE u.role = 'ADMIN') AS admin_users,
    COUNT(*) FILTER (WHERE u.account_status = 'ACTIVE') AS active_users
  FROM buildvest_user_profiles bp
  INNER JOIN users u
    ON u.id = bp.user_id
`),

      pool.query(`
        SELECT
          COUNT(*) AS total_properties,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_properties,
          COUNT(*) FILTER (WHERE status = 'INACTIVE') AS inactive_properties,
          COALESCE(SUM(total_value), 0) AS total_property_value,
          COALESCE(SUM(total_units), 0) AS total_units,
          COALESCE(SUM(total_units - available_units), 0) AS allocated_units
        FROM buildvest_properties
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_investments,
          COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_investments,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_investments,
          COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_investments,
          COALESCE(
            SUM(amount) FILTER (WHERE status = 'APPROVED'),
            0
          ) AS total_approved_investment_value,
          COALESCE(
            SUM(units) FILTER (WHERE status = 'APPROVED'),
            0
          ) AS allocated_investment_units
        FROM buildvest_investments
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_transactions,
          COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful_transactions,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_transactions,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_transactions,
          COALESCE(
            SUM(amount) FILTER (WHERE status = 'SUCCESS'),
            0
          ) AS total_successful_payments
        FROM buildvest_transactions
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_referrals,
          COUNT(*) FILTER (WHERE status = 'REGISTERED') AS registered_referrals,
          COUNT(*) FILTER (WHERE status = 'QUALIFIED') AS qualified_referrals,
          COUNT(*) FILTER (WHERE status = 'REWARDED') AS rewarded_referrals
        FROM buildvest_referrals
      `),

            pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE status = 'PENDING'
          ) AS pending_funding_requests
        FROM buildvest_funding_requests
      `),
    ]);

    res.json({
      success: true,
      dashboard: {
        users: userSummary.rows[0],
        properties: propertySummary.rows[0],
        investments: investmentSummary.rows[0],
        transactions: transactionSummary.rows[0],
        referrals: referralSummary.rows[0],
        funding: fundingSummary.rows[0],
      },
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve admin dashboard",
    });
  }
}

module.exports = {
  getAdminDashboard,
};