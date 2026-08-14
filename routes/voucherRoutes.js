const express = require('express');
const router = express.Router();
const { getAllVouchersForAdmin, createVoucher, updateVoucher, deleteVoucher, getAllVouchersForUser, previewVoucher } = require('../controllers/voucherController');
const { authenticateJWT } = require('../middleware/authMiddleware');


//get all vouchers for admin
router.get('/get-all-vouchers', authenticateJWT, getAllVouchersForAdmin);
//create voucher for admin
router.post('/create-voucher', authenticateJWT, createVoucher);
//update voucher for admin
router.put('/update-voucher/:id', authenticateJWT, updateVoucher);
//disable voucher for admin
router.delete('/disable-voucher/:id', authenticateJWT, deleteVoucher);


//get all vouchers for users
router.get('/get-all', getAllVouchersForUser);
//preview voucher 
router.post('/apply-voucher', previewVoucher);


module.exports = router;
