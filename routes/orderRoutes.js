const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const {
  createOrder,
  getAllOrders,
  searchOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn
} = require('../controllers/orderController');
const orderController = require('../controllers/orderController');


router.post('/', authenticateJWT, createOrder);
router.get('/', authenticateJWT, getAllOrders);
router.get('/search', authenticateJWT, searchOrders);
router.post('/payment-url', authenticateJWT, createVnpayPaymentUrl);
router.get('/vnpay-return', vnpayReturn);
router.get('/vnpay-ipn', vnpayIpn);
router.get('/:id', authenticateJWT, getOrderById);
router.put('/:id', authenticateJWT, updateOrder);
router.delete('/:id', authenticateJWT, deleteOrder);

//apply voucher
router.post('/checkout', authenticateJWT, orderController.checkout);
module.exports = router;