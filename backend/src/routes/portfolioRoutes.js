const express = require("express");

const {
  getMyPortfolio,
  getPortfolioSummary,
} = require("../controllers/portfolioController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/summary",
  authenticateToken,
  getPortfolioSummary
);

router.get(
  "/my",
  authenticateToken,
  getMyPortfolio
);

module.exports = router;