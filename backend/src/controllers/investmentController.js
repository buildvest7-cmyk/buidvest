const pool = require("../config/database");

async function createInvestment(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { property_id, units } = req.body;

    const verificationResult = await client.query(
  `
  SELECT
    verification_status
  FROM buildvest_user_profiles
  WHERE user_id = $1
  `,
  [userId]
);

if (
  verificationResult.rows.length === 0 ||
  verificationResult.rows[0].verification_status !== "VERIFIED"
) {
  return res.status(403).json({
    success: false,
    message: "BuildVest account must be verified before investing",
  });
}

    if (!property_id || units === undefined) {
      return res.status(400).json({
        success: false,
        message: "Property and units are required",
      });
    }

    const requestedUnits = Number(units);

    if (!Number.isInteger(requestedUnits) || requestedUnits <= 0) {
      return res.status(400).json({
        success: false,
        message: "Units must be a positive whole number",
      });
    }

    await client.query("BEGIN");

    const propertyResult = await client.query(
      `
      SELECT
        id,
        title,
        total_value,
        total_units,
        available_units,
        status
      FROM buildvest_properties
      WHERE id = $1
      FOR UPDATE
      `,
      [property_id]
    );

    if (propertyResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const property = propertyResult.rows[0];

    if (property.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Property is not currently available",
      });
    }

    if (requestedUnits > property.available_units) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Not enough units available",
      });
    }

 const amountResult = await client.query(
  `
  SELECT ROUND(
    (total_value / NULLIF(total_units, 0)) * $1,
    2
  ) AS amount
  FROM buildvest_properties
  WHERE id = $2
  `,
  [requestedUnits, property_id]
);

const amount = amountResult.rows[0].amount;

    const investmentResult = await client.query(
      `
      INSERT INTO buildvest_investments (
        user_id,
        property_id,
        amount,
        units,
        status
      )
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING
        id,
        user_id,
        property_id,
        amount,
        units,
        status,
        created_at
      `,
      [
        userId,
        property_id,
        amount,
        requestedUnits,
      ]
    );

 await client.query(
  `
  UPDATE buildvest_properties
  SET available_units = available_units - $1
  WHERE id = $2
  `,
  [requestedUnits, property_id]
);

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Investment created successfully",
      investment: investmentResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create investment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create investment",
    });
  } finally {
    client.release();
  }
}

async function getMyInvestments(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.property_id,
        p.title AS property_title,
        p.location,
        p.property_type,
        i.amount,
        i.units,
        i.status,
        i.created_at
      FROM buildvest_investments i
      INNER JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      investments: result.rows,
    });
  } catch (error) {
    console.error("Get my investments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve investments",
    });
  }
}

async function getInvestmentById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.user_id,
        i.property_id,
        p.title AS property_title,
        p.description AS property_description,
        p.location,
        p.property_type,
        p.total_value,
        p.total_units,
        i.amount,
        i.units,
        i.status,
        i.created_at
      FROM buildvest_investments i
      INNER JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE i.id = $1
        AND i.user_id = $2
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    res.json({
      success: true,
      investment: result.rows[0],
    });
  } catch (error) {
    console.error("Get investment by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve investment",
    });
  }
}

async function getAllInvestments(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.user_id,
        u.full_name AS investor_name,
        u.email AS investor_email,
        i.property_id,
        p.title AS property_title,
        p.location,
        i.amount,
        i.units,
        i.status,
        i.created_at
      FROM buildvest_investments i
      INNER JOIN users u
        ON u.id = i.user_id
      INNER JOIN buildvest_properties p
        ON p.id = i.property_id
      ORDER BY i.created_at DESC
    `);

    res.json({
      success: true,
      investments: result.rows,
    });
  } catch (error) {
    console.error("Get all investments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve investments",
    });
  }
}

async function approveInvestment(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE buildvest_investments
      SET status = 'APPROVED'
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING
        id,
        user_id,
        property_id,
        amount,
        units,
        status,
        created_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending investment not found",
      });
    }

    res.json({
      success: true,
      message: "Investment approved successfully",
      investment: result.rows[0],
    });
  } catch (error) {
    console.error("Approve investment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to approve investment",
    });
  }
}

async function rejectInvestment(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const investmentResult = await client.query(
      `
      SELECT
        id,
        property_id,
        units,
        status
      FROM buildvest_investments
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (investmentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    const investment = investmentResult.rows[0];

    if (investment.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Only pending investments can be rejected",
      });
    }

    await client.query(
      `
      UPDATE buildvest_properties
SET available_units = LEAST(total_units, available_units + $1)
WHERE id = $2
      `,
      [investment.units, investment.property_id]
    );

    const result = await client.query(
      `
      UPDATE buildvest_investments
      SET status = 'REJECTED'
      WHERE id = $1
      RETURNING
        id,
        user_id,
        property_id,
        amount,
        units,
        status,
        created_at
      `,
      [id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Investment rejected successfully",
      investment: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Reject investment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reject investment",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  createInvestment,
  getMyInvestments,
  getInvestmentById,
  getAllInvestments,
  approveInvestment,
  rejectInvestment,
};