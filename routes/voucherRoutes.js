const express = require('express');
const router = express.Router();
const { getAllVouchers, createVoucher, updateVoucher, deleteVoucher } = require('../controllers/voucherController');

//get all vouchers for admin
router.get('/get-all-vouchers', getAllVouchers);
//create voucher for admin
router.post('/create-voucher', createVoucher);
//update voucher for admin
router.put('/update-voucher/:id', updateVoucher);
//disable voucher for admin
router.delete('/disable-voucher/:id', deleteVoucher);

module.exports = router;
