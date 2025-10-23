const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const statisticController = require('../controllers/statisticController');

// View Customer Statistics (Admin/Manager only)
// router.get('/customers', authenticateJWT, authorizeRole(['admin']), statisticController.viewCustomerStats);

// View Revenue Statistics (Admin/Manager only)
// router.get('/revenue', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueStats);

// View Order Statistics (Admin/Manager only)
// router.get('/orders', authenticateJWT, authorizeRole(['admin']), statisticController.viewOrderStats);

// View Revenue by Week (Admin/Manager only)
router.get('/revenue/revenue-by-week', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByWeek);

// View Revenue by Month (Admin/Manager only)
router.get('/revenue/revenue-by-month', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByMonth);

// View Revenue by Year (Admin/Manager only)
router.get('/revenue/revenue-by-year', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByYear);

// View Revenue by Day (Admin/Manager only)
router.get('/revenue/revenue-by-day', authenticateJWT, authorizeRole(['admin']), statisticController.viewRevenueByDay);

// ========================================================================
// 🆕 THÊM CÁC ROUTE MỚI TỪ FILE THỨ HAI (CUSTOMER + PRODUCT STATISTICS)
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
} = require('../controllers/customerStatisticsController');

// ===============================
// 🧍 CUSTOMER STATISTICS
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

// ===============================
// 📦 PRODUCT STATISTICS
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

// ✅ Export cuối cùng (đặt sau cùng để router hoạt động đúng)
module.exports = router;
