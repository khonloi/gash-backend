const mongoose = require("mongoose");
const feedbackService = require("../services/feedbackService");

// Function to get all feedback for admin and staff
exports.getAllFeedback = async (req, res) => {
  try {
    const result = await feedbackService.getAllFeedback(req.query);
    res.status(200).json({
      success: true,
      message: "Feedbacks retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get all feedback error:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving feedbacks",
      stack: error.stack,
    });
  }
};

// Function to get a specific feedback by ID
exports.getFeedbackById = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const feedback = await feedbackService.getFeedbackById(feedbackId);
    res.status(200).json({
      success: true,
      message: "Feedback retrieved successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Get feedback by ID error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Error retrieving feedback",
    });
  }
};

// Function to get overall feedback statistics
exports.getFeedbackSummary = async (req, res) => {
  try {
    const result = await feedbackService.getFeedbackSummary(req.query);
    res.status(200).json({
      success: true,
      message: "Feedback statistics retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get feedback statistics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving feedback statistics",
    });
  }
};

// Function to delete feedback (soft delete) for admin
exports.deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const result = await feedbackService.deleteFeedback(feedbackId);
    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Delete feedback error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Error deleting feedback",
    });
  }
};

// Function to restore deleted feedback for admin
exports.restoreFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const result = await feedbackService.restoreFeedback(feedbackId);
    res.status(200).json({
      success: true,
      message: "Feedback restored successfully",
      data: result,
    });
  } catch (error) {
    console.error("Restore feedback error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Error restoring feedback",
    });
  }
};
