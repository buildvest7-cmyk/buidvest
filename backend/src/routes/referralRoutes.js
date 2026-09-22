const express = require("express");

const {
  createReferral,
  getMyReferrals,
  getAllReferrals,
  updateReferralStatus,
} = require("../controllers/referralController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", authenticateToken, createReferral);

router.get("/my", authenticateToken, getMyReferrals);

router.get("/admin/all", authenticateToken, requireAdmin, getAllReferrals);

router.patch("/:id/status", authenticateToken, requireAdmin, updateReferralStatus);

module.exports = router;