const express = require("express");

const {
  createTransfer,
  getMyTransfers,
  getReceivedTransfers,
  getAllTransfers,
  updateTransferStatus,
 getMyWallet,
getAllWallets,
fundWalletForTesting,
getWalletTransactions,
} = require("../controllers/transferController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  createTransfer
);

router.get(
  "/my",
  authenticateToken,
  getMyTransfers
);


router.get(
  "/received",
  authenticateToken,
  getReceivedTransfers
);

router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  getAllTransfers
);

router.get(
  "/admin/wallets",
  authenticateToken,
  requireAdmin,
  getAllWallets
);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updateTransferStatus
);

router.get(
  "/wallet",
  authenticateToken,
  getMyWallet
);

router.get(
  "/wallet/transactions",
  authenticateToken,
  getWalletTransactions
);

router.post(
  "/admin/fund",
  authenticateToken,
  requireAdmin,
  fundWalletForTesting
);
module.exports = router;