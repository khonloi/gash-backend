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

module.exports = router;