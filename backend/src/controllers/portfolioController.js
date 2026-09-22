const pool = require("../config/database");

async function getMyPortfolio(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        p.id AS property_id,
        p.title AS property_title,
        p.location,
        p.property_type,
        p.total_value,
        p.total_units,
        SUM(i.units) AS owned_units,
        SUM(i.amount) AS total_invested,
        COUNT(i.id) AS investment_count
      FROM buildvest_investments i
      INNER JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE i.user_id = $1
        AND i.status = 'APPROVED'
      GROUP BY
        p.id,
        p.title,
        p.location,
        p.property_type,
        p.total_value,
        p.total_units
      ORDER BY total_invested DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      portfolio: result.rows,
    });
  } catch (error) {
    console.error("Get portfolio error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio",
    });
  }
}

async function getPortfolioSummary(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT property_id) AS property_count,
        COALESCE(SUM(units), 0) AS total_owned_units,
        COALESCE(SUM(amount), 0) AS total_invested
      FROM buildvest_investments
      WHERE user_id = $1
        AND status = 'APPROVED'
      `,
      [userId]
    );

    res.json({
      success: true,
      summary: result.rows[0],
    });
  } catch (error) {
    console.error("Get portfolio summary error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio summary",
    });
  }
}

module.exports = {
  getMyPortfolio,
  getPortfolioSummary,
};