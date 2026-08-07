const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const statisticController = require('../controllers/statisticController');

// View Revenue by Week (Admin/Manager only)
router.get('/revenue/revenue-by-week', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByWeek);

// View Revenue by Month (Admin/Manager only)
router.get('/revenue/revenue-by-month', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByMonth);

// View Revenue by Year (Admin/Manager only)
router.get('/revenue/revenue-by-year', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByYear);

// View Revenue by Day (Admin/Manager only)
router.get('/revenue/revenue-by-day', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByDay);

// ========================================================================
// CUSTOMER + PRODUCT STATISTICS
// ========================================================================
const {
  getProductStatistics,
  exportProductStatistics,
  getCategoryDistribution,
  getTopProducts,
} = require('../controllers/productStatisticsController');

const {
  getCustomerStatistics,
  exportCustomerStatistics,
  getTopCustomers,
  getCustomerSparkline,
} = statisticController;

// ===============================
// CUSTOMER STATISTICS
// ===============================
router.get(
  '/customers',
  authenticateJWT,
  authorizeRole(['admin']),
  getCustomerStatistics
);

router.get(
  '/customers/export',
  authenticateJWT,
  authorizeRole(['admin']),
  exportCustomerStatistics
);

// Top Customers
router.get(
  '/customers/top',
  authenticateJWT,
  authorizeRole(['admin']),
  getTopCustomers
);

// Sparkline Data
router.get(
  '/customers/sparkline',
  authenticateJWT,
  authorizeRole(['admin']),
  getCustomerSparkline
);


// ===============================
// PRODUCT STATISTICS
// ===============================
router.get(
  '/products',
  authenticateJWT,
  authorizeRole(['admin']),
  getProductStatistics
);

router.get(
  '/products/categories',
  authenticateJWT,
  authorizeRole(['admin']),
  getCategoryDistribution
);

router.get(
  '/products/top',
  authenticateJWT,
  authorizeRole(['admin']),
  getTopProducts
);

router.get(
  '/products/export',
  authenticateJWT,
  authorizeRole(['admin']),
  exportProductStatistics
);

// Export router
module.exports = router;
