const express = require('express');
const router = express.Router();
const { exportBill, exportMultipleBills, getExportableOrders } = require('../controllers/billController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Export bill for a specific order
router.get('/export-bill/:orderId', authenticateJWT, exportBill);


module.exports = router;
