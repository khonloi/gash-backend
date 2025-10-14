const express = require("express");
const router = express.Router();
const { authenticateJWT, authorizeRole } = require("../middleware/authMiddleware");
const feedbackController = require("../controllers/feedbackController");

// Get all feedbacks with pagination and filters (Admin/Staff only)
router.get("/get-all-feedbacks", authenticateJWT, authorizeRole(['admin', 'staff']), feedbackController.getAllFeedback);

// Get feedback by ID (Admin/Staff only)
router.get("/get-feedback-by-id/:feedbackId", authenticateJWT, authorizeRole(['admin', 'staff']), feedbackController.getFeedbackById);

// Delete feedback (soft delete) (Admin/Staff only)
router.delete("/delete-feedback/:feedbackId", authenticateJWT, authorizeRole(['admin', 'staff']), feedbackController.deleteFeedback);

// Restore deleted feedback (Admin/Staff only)
router.patch("/restore-feedback/:feedbackId", authenticateJWT, authorizeRole(['admin', 'staff']), feedbackController.restoreFeedback);

module.exports = router;
