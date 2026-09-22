const express = require("express");

const {
  getBuildVestUsers,
  updateBuildVestUserStatus,
  getMyBuildVestProfile,
  updateBuildVestUserVerification,
} = require("../controllers/userController");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireAdmin,
  getBuildVestUsers
);

router.get(
  "/me",
  authenticateToken,
  getMyBuildVestProfile
);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updateBuildVestUserStatus
);

router.patch(
  "/:id/verification",
  authenticateToken,
  requireAdmin,
  updateBuildVestUserVerification
);

module.exports = router;