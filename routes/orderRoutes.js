const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');
const {
  createOrder,
  getAllOrders,
  searchOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn,
  cancelOrder,
  addFeedbackProduct,
  editFeedbackProduct,
  deleteFeedbackProduct,
  getAllFeedbackOfProduct
} = require('../controllers/orderController');
const orderController = require('../controllers/orderController');


router.post('/', authenticateJWT, createOrder);
router.get('/', authenticateJWT, getAllOrders);
router.get('/search', authenticateJWT, searchOrders);
router.post('/payment-url', authenticateJWT, createVnpayPaymentUrl);
router.get('/vnpay-return', vnpayReturn);
router.get('/vnpay-ipn', vnpayIpn);
// api get 1 order by id
router.get('/get-order-by-id/:id', authenticateJWT, getOrderById);
router.put('/:id', authenticateJWT, updateOrder);
router.delete('/:id', authenticateJWT, deleteOrder);

// api checkout
router.post('/checkout', authenticateJWT, orderController.checkout);
// api cancel order
router.patch('/:id/cancel', authenticateJWT, cancelOrder);
//api add feedback for variant of order
router.patch('/:orderId/add-feedback/:variantId', authenticateJWT, addFeedbackProduct);
// api edit feedback for variant of order
router.put('/:orderId/edit-feedback/:variantId', authenticateJWT, editFeedbackProduct);
// api delete feedback for variant of order
router.delete('/:orderId/delete-feedback/:variantId', authenticateJWT, deleteFeedbackProduct);
// api get all feedback for product (many variants of product)
router.get('/get-all-feedback/:productId', optionalAuth, getAllFeedbackOfProduct);

module.exports = router;