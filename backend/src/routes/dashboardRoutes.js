const express = require("express");

const {
  getUserDashboard,
} = require("../controllers/dashboardController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, getUserDashboard);

module.exports = router;