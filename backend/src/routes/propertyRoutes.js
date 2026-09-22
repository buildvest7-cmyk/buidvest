const express = require("express");

const {
  getProperties,
  getPropertyById,
  getAllProperties,
  createProperty,
  updatePropertyStatus,
  updateProperty,
} = require("../controllers/propertyController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", getProperties);
router.get("/admin/all", authenticateToken, requireAdmin, getAllProperties);

router.get("/:id", getPropertyById);

router.post("/", authenticateToken, requireAdmin, createProperty);

router.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  updateProperty
);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updatePropertyStatus
);

module.exports = router;