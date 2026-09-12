const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { checkoutSchema, updateOrderSchema, cancelOrderSchema } = require('../validations/orderValidation');
const {
  getAllOrderForAdmin,
  searchOrders,
  getOrderById,
  updateOrderByAdmin,
  deleteOrder,
  createVnpayPaymentUrl,
  vnpayReturn,
  // vnpayIpn,
  cancelOrder,
  getUserOrders, // New endpoint
} = require('../controllers/orderController');
const orderController = require('../controllers/orderController');

// router.post('/', authenticateJWT, createOrder); 
// router.get('/', authenticateJWT, getAllOrders);
// router.get('/search', authenticateJWT, searchOrders); 
// router.get('/vnpay-ipn', vnpayIpn); // User không sử dụng
// router.put('/:id', authenticateJWT, updateOrder);
// router.delete('/:id', authenticateJWT, deleteOrder); 

// USER APIs
// api checkout for user
router.post('/checkout', authenticateJWT, validateRequest(checkoutSchema), orderController.checkout);

// api create payment url for vnpay
router.post('/payment-url', authenticateJWT, createVnpayPaymentUrl);

// api vnpay return
router.get('/vnpay-return', vnpayReturn);

// api cancel order for user
router.patch('/:id/cancel', authenticateJWT, validateRequest(cancelOrderSchema), cancelOrder);

// api get 1 order by id for user and admin
router.get('/get-order-by-id/:id', authenticateJWT, getOrderById);

// api get all orders for a specific user
router.get('/user/:acc_id', authenticateJWT, getUserOrders);

// ADMIN APIs
// Lấy tất cả đơn hàng cho admin
router.get('/admin/get-all-order', authenticateJWT, authorizeRole(['admin', 'manager']), getAllOrderForAdmin);

// Cập nhật đơn hàng - Chỉ Admin/Staff
router.put('/admin/update/:orderId', authenticateJWT, authorizeRole(['admin', 'manager']), validateRequest(updateOrderSchema), updateOrderByAdmin);

module.exports = router;