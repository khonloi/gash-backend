// routes/statRoutes.js
const express = require("express");
const router = express.Router();
const {
  authenticateJWT,
  authorizeRole,
} = require("../middleware/authMiddleware");
const {
  getOrderStatistics,
} = require("../controllers/statistics/orderStatisticController");

router.get(
  "/order-statistics",
  authenticateJWT,
  authorizeRole(["manager", "admin"]),
  getOrderStatistics
);

module.exports = router;
