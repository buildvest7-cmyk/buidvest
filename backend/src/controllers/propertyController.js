const pool = require("../config/database");

async function getProperties(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        location,
        property_type,
        total_value,
total_units,
available_units,
(total_value / NULLIF(total_units, 0)) AS unit_price,
(total_units - available_units) AS allocated_units,
CASE
  WHEN total_units > 0
  THEN ROUND(
    ((total_units - available_units)::numeric / total_units::numeric) * 100,
    2
  )
  ELSE 0
END AS allocation_percentage,
status,
created_at
      FROM buildvest_properties
      WHERE status = 'ACTIVE'
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      properties: result.rows,
    });
  } catch (error) {
    console.error("Get properties error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve properties",
    });
  }
}

async function createProperty(req, res) {
  try {
    const {
      title,
      description,
      location,
      property_type,
      total_value,
      total_units,
      available_units,
    } = req.body;

    if (
      !title ||
      !location ||
      total_value === undefined ||
      total_units === undefined ||
      available_units === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Required property fields are missing",
      });
    }

    if (
      Number(total_value) <= 0 ||
      Number(total_units) <= 0 ||
      Number(available_units) < 0 ||
      Number(available_units) > Number(total_units)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid property values",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO buildvest_properties (
        title,
        description,
        location,
        property_type,
        total_value,
        total_units,
        available_units
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        title,
        description,
        location,
        property_type,
        total_value,
        total_units,
        available_units,
        status,
        created_at
      `,
      [
        title,
        description || null,
        location,
        property_type || null,
        total_value,
        total_units,
        available_units,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Create property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create property",
    });
  }
}

async function getPropertyById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        location,
        property_type,
        total_value,
total_units,
available_units,
(total_value / NULLIF(total_units, 0)) AS unit_price,
(total_units - available_units) AS allocated_units,
CASE
  WHEN total_units > 0
  THEN ROUND(
    ((total_units - available_units)::numeric / total_units::numeric) * 100,
    2
  )
  ELSE 0
END AS allocation_percentage,
status,
created_at
      FROM buildvest_properties
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Get property by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve property",
    });
  }
}

async function getAllProperties(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        location,
        property_type,
        total_value,
        total_units,
        available_units,
        status,
        created_at
      FROM buildvest_properties
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      properties: result.rows,
    });
  } catch (error) {
    console.error("Get all properties error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve properties",
    });
  }
}

async function updatePropertyStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property status",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_properties
      SET status = $1
      WHERE id = $2
      RETURNING
        id,
        title,
        location,
        property_type,
        total_value,
        total_units,
        available_units,
        status,
        created_at
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      message: "Property status updated successfully",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Update property status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update property status",
    });
  }
}

async function updateProperty(req, res) {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      location,
      property_type,
      total_value,
    } = req.body;

    if (
      !title ||
      !location ||
      total_value === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, location, and total value are required",
      });
    }

    if (Number(total_value) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total value must be greater than zero",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_properties
      SET
        title = $1,
        description = $2,
        location = $3,
        property_type = $4,
        total_value = $5
      WHERE id = $6
      RETURNING
        id,
        title,
        description,
        location,
        property_type,
        total_value,
        total_units,
        available_units,
        status,
        created_at
      `,
      [
        title,
        description || null,
        location,
        property_type || null,
        total_value,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      message: "Property updated successfully",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Update property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update property",
    });
  }
}



module.exports = {
  getProperties,
  getPropertyById,
  getAllProperties,
  createProperty,
  updatePropertyStatus,
  updateProperty,
};