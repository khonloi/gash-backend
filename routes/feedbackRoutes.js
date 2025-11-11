const express = require("express");
const router = express.Router();
const { authenticateJWT, authorizeRole, optionalAuth } = require("../middleware/authMiddleware");
const feedbackController = require("../controllers/feedbackController");
const { getAllFeedbackOfProduct, addFeedbackProduct, editFeedbackProduct, deleteFeedbackProduct } = require('../controllers/orderController');


// USER APIs
// api get all feedback for product (many variants of product)
router.get('/get-all-feedback/:productId', optionalAuth, getAllFeedbackOfProduct);

//api add feedback for variant of order
router.patch('/:orderId/add-feedback/:variantId', authenticateJWT, addFeedbackProduct);

// api edit feedback for variant of order for user
router.put('/:orderId/edit-feedback/:variantId', authenticateJWT, editFeedbackProduct);

// api delete feedback for variant of order for user
router.delete('/:orderId/delete-feedback/:variantId', authenticateJWT, deleteFeedbackProduct);




// ADMIN APIs
// Get all feedbacks with pagination and filters (Admin/Staff only)
router.get("/get-all-feedbacks", authenticateJWT, authorizeRole(['admin', 'manager']), feedbackController.getAllFeedback);

// Get feedback by ID (Admin/Staff only)
router.get("/get-feedback-by-id/:feedbackId", authenticateJWT, authorizeRole(['admin', 'manager']), feedbackController.getFeedbackById);

// Delete feedback (soft delete) (Admin/Staff only)
router.delete("/delete-feedback/:feedbackId", authenticateJWT, authorizeRole(['admin', 'manager']), feedbackController.deleteFeedback);

// Restore deleted feedback (Admin/Staff only)
router.patch("/restore-feedback/:feedbackId", authenticateJWT, authorizeRole(['admin', 'manager']), feedbackController.restoreFeedback);

module.exports = router;
