const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');
const {
  createOrder,
  getAllOrders,
  getAllOrderForAdmin,
  searchOrders,
  getOrderById,
  updateOrderByAdmin,
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


// router.post('/', authenticateJWT, createOrder); 
router.get('/', authenticateJWT, getAllOrders);
// router.get('/search', authenticateJWT, searchOrders); 
router.post('/payment-url', authenticateJWT, createVnpayPaymentUrl);
router.get('/vnpay-return', vnpayReturn);
// router.get('/vnpay-ipn', vnpayIpn); // User không sử dụng
// api get 1 order by id for user
router.get('/get-order-by-id/:id', authenticateJWT, getOrderById);
// router.put('/:id', authenticateJWT, updateOrder);
// router.delete('/:id', authenticateJWT, deleteOrder); 

// api checkout for user
router.post('/checkout', authenticateJWT, orderController.checkout);
// api cancel order for user
router.patch('/:id/cancel', authenticateJWT, cancelOrder);
//api add feedback for variant of order
router.patch('/:orderId/add-feedback/:variantId', authenticateJWT, addFeedbackProduct);
// api edit feedback for variant of order for user
router.put('/:orderId/edit-feedback/:variantId', authenticateJWT, editFeedbackProduct);
// api delete feedback for variant of order for user
router.delete('/:orderId/delete-feedback/:variantId', authenticateJWT, deleteFeedbackProduct);
// api get all feedback for product (many variants of product)
router.get('/get-all-feedback/:productId', optionalAuth, getAllFeedbackOfProduct);

// ===== ADMIN APIs =====
// Lấy tất cả đơn hàng cho admin
router.get('/admin/get-all-order', authenticateJWT, authorizeRole(['admin', 'manager']), getAllOrderForAdmin);

// Cập nhật đơn hàng - Chỉ Admin/Staff
router.put('/admin/update/:orderId', authenticateJWT, authorizeRole(['admin', 'staff']), updateOrderByAdmin);


module.exports = router;