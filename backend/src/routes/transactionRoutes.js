const express = require("express");

const {
  createTransaction,
  getMyTransactions,
  getAllTransactions,
  getTransactionById,
  getTransactionByReference,
  updateTransactionStatus,
} = require("../controllers/transactionController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", authenticateToken, createTransaction);

router.get("/my", authenticateToken, getMyTransactions);

router.get("/admin/all", authenticateToken, requireAdmin, getAllTransactions);

router.get(
  "/reference/:reference",
  authenticateToken,
  getTransactionByReference
);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updateTransactionStatus
);

router.get("/:id", authenticateToken, getTransactionById);

module.exports = router;