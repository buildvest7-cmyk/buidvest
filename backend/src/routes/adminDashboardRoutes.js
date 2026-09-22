const express = require("express");

const {
  getAdminDashboard,
} = require("../controllers/adminDashboardController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireAdmin,
  getAdminDashboard
);

module.exports = router;