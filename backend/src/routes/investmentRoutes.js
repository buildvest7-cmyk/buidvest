const express = require("express");

const {
  createInvestment,
  getMyInvestments,
  getInvestmentById,
  getAllInvestments,
  approveInvestment,
  rejectInvestment,
} = require("../controllers/investmentController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", authenticateToken, createInvestment);

router.get("/my", authenticateToken, getMyInvestments);

router.get("/admin/all", authenticateToken, requireAdmin, getAllInvestments);

router.patch("/:id/approve", authenticateToken, requireAdmin, approveInvestment);

router.patch("/:id/reject", authenticateToken, requireAdmin, rejectInvestment);

router.get("/:id", authenticateToken, getInvestmentById);

module.exports = router;