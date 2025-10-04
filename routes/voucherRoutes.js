const express = require('express');
const router = express.Router();
const { getAllVouchers, createVoucher } = require('../controllers/voucherController');

//get all vouchers for admin
router.get('/get-all-vouchers', getAllVouchers);
//create voucher for admin
router.post('/create-voucher', createVoucher);

module.exports = router;
