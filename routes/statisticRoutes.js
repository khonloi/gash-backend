const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const statisticController = require('../controllers/statisticController');

// View Revenue by Week (Admin/Manager only)
router.get('/revenue/revenue-by-week', authenticateJWT, authorizeRole(['admin', 'manager']), statisticController.viewRevenueByWeek);

// View Revenue by Month (Admin/Manager only)
router.get('/revenue/revenue-by-month', authenticateJWT, authorizeRole(['admin', 'manager']), statisticController.viewRevenueByMonth);

// View Revenue by Year (Admin/Manager only)
router.get('/revenue/revenue-by-year', authenticateJWT, authorizeRole(['admin', 'manager']), statisticController.viewRevenueByYear);

// View Revenue by Day (Admin/Manager only)
router.get('/revenue/revenue-by-day', authenticateJWT, authorizeRole(['admin', 'manager']), statisticController.viewRevenueByDay);

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
  authorizeRole(['admin', 'manager']),
  getCustomerStatistics
);

router.get(
  '/customers/export',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  exportCustomerStatistics
);

// Top Customers
router.get(
  '/customers/top',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  getTopCustomers
);

// Sparkline Data
router.get(
  '/customers/sparkline',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  getCustomerSparkline
);


// ===============================
// PRODUCT STATISTICS
// ===============================
router.get(
  '/products',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  getProductStatistics
);

router.get(
  '/products/categories',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  getCategoryDistribution
);

router.get(
  '/products/top',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  getTopProducts
);

router.get(
  '/products/export',
  authenticateJWT,
  authorizeRole(['admin', 'manager']),
  exportProductStatistics
);

// Export router
module.exports = router;
