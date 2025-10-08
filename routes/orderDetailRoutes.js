const express = require("express");
const router = express.Router();
const { authenticateJWT, authorizeRole } = require("../middleware/authMiddleware");
const orderDetailController = require("../controllers/orderDetailController");

// Advanced search/filter for order details with feedback
router.get('/order-detail/search', authenticateJWT, orderDetailController.searchOrderDetails);

// Create a new order detail
router.post("/create-order-detail", authenticateJWT, orderDetailController.createOrderDetail);

// Get all order details
router.get("/get-all-order-details/:orderId", authenticateJWT, orderDetailController.getAllOrderDetails);

// Get a single order detail by ID 
router.get("/get-order-detail-by-id/:id", authenticateJWT, orderDetailController.getOrderDetailById);

// Update an order detail
router.put("/update-order-detail/:id", authenticateJWT, orderDetailController.updateOrderDetail);

// Delete an order detail
router.delete("/delete-order-detail/:id", authenticateJWT, orderDetailController.deleteOrderDetail);

// Get all order details for a product with non-empty feedback
router.get("/get-order-details-by-product/:pro_id", orderDetailController.getOrderDetailsByProduct);

module.exports = router;