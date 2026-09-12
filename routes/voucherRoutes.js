const express = require('express');
const router = express.Router();
const { getAllVouchersForAdmin, createVoucher, updateVoucher, deleteVoucher, previewVoucher } = require('../controllers/voucherController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

// Get all vouchers for admin
router.get('/get-all-vouchers', authenticateJWT, getAllVouchersForAdmin);
// Create voucher for admin
router.post('/create-voucher', authenticateJWT, createVoucher);
// Update voucher for admin
router.put('/update-voucher/:id', authenticateJWT, updateVoucher);
// Disable voucher for admin
router.delete('/disable-voucher/:id', authenticateJWT, deleteVoucher);

// Preview voucher 
router.post('/apply-voucher', previewVoucher);

module.exports = router;
