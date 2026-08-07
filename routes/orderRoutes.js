const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');
const orderDetailController = require('../controllers/orderDetailController');

// ==========================================
// 1. USER ORDER APIs
// ==========================================

// Checkout for user
router.post('/checkout', authenticateJWT, orderController.checkout);

// Create payment URL for VNPay
router.post('/payment-url', authenticateJWT, orderController.createVnpayPaymentUrl);

// VNPay return callback
router.get('/vnpay-return', orderController.vnpayReturn);

// Cancel order for user
router.patch('/:id/cancel', authenticateJWT, orderController.cancelOrder);

// Get single order by ID
router.get('/get-order-by-id/:id', authenticateJWT, orderController.getOrderById);

// Get all orders for a specific user
router.get('/user/:accountId', authenticateJWT, orderController.getUserOrders);

// ==========================================
// 2. ADMIN ORDER APIs
// ==========================================

// Get all orders for admin/manager
router.get('/admin/get-all-order', authenticateJWT, authorizeRole(['admin', 'manager']), orderController.getAllOrderForAdmin);

// Update order by admin/manager
router.put('/admin/update/:orderId', authenticateJWT, authorizeRole(['admin', 'manager']), orderController.updateOrderByAdmin);

// ==========================================
// 3. ORDER DETAIL APIs
// ==========================================

// Advanced search/filter for order details with feedback
router.get('/order-detail/search', authenticateJWT, orderDetailController.searchOrderDetails);
router.get('/search', authenticateJWT, orderDetailController.searchOrderDetails);

// Create a new order detail
router.post('/create-order-detail', authenticateJWT, orderDetailController.createOrderDetail);

// Get all order details for an order
router.get('/get-all-order-details/:orderId', authenticateJWT, orderDetailController.getAllOrderDetails);

// Get a single order detail by ID
router.get('/get-order-detail-by-id/:id', authenticateJWT, orderDetailController.getOrderDetailById);

// Update an order detail
router.put('/update-order-detail/:id', authenticateJWT, orderDetailController.updateOrderDetail);

// Delete an order detail
router.delete('/delete-order-detail/:id', authenticateJWT, orderDetailController.deleteOrderDetail);

// Get all order details for a product with feedback
router.get('/get-order-details-by-product/:productId', orderDetailController.getOrderDetailsByProduct);
router.get('/product/:productId', orderDetailController.getOrderDetailsByProduct);

module.exports = router;