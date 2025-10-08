const express = require('express');
const router = express.Router();
const { exportBill, exportMultipleBills, getExportableOrders } = require('../controllers/billController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Export bill cho một order cụ thể
router.get('/export-bill/:orderId', authenticateJWT, exportBill);


module.exports = router;
