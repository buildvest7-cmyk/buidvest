const express = require("express");

const {
  createFundingRequest,
  getMyFundingRequests,
  getAllFundingRequests,
  approveFundingRequest,
  rejectFundingRequest,
} = require("../controllers/fundingController");

const authenticateToken =
  require("../middleware/authMiddleware");

const requireAdmin =
  require("../middleware/adminMiddleware");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  createFundingRequest
);

router.get(
  "/my",
  authenticateToken,
  getMyFundingRequests
);

router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  getAllFundingRequests
);

router.patch(
  "/admin/:id/approve",
  authenticateToken,
  requireAdmin,
  approveFundingRequest
);

router.patch(
  "/admin/:id/reject",
  authenticateToken,
  requireAdmin,
  rejectFundingRequest
);

module.exports = router;