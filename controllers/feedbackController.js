const mongoose = require("mongoose");
const feedbackService = require("../services/feedbackService");
const catchAsync = require('./utils/catchAsync');

// Function to get all feedback for admin and staff
exports.getAllFeedback = catchAsync(async (req, res) => {
  const result = await feedbackService.getAllFeedback(req.query);
  res.status(200).json({
    success: true,
    message: "Feedbacks retrieved successfully",
    data: result,
  });
});

// Function to get a specific feedback by ID
exports.getFeedbackById = catchAsync(async (req, res) => {
  const { feedbackId } = req.params;
  const feedback = await feedbackService.getFeedbackById(feedbackId);
  res.status(200).json({
    success: true,
    message: "Feedback retrieved successfully",
    data: feedback,
  });
});

// Function to get overall feedback statistics
exports.getFeedbackSummary = catchAsync(async (req, res) => {
  const result = await feedbackService.getFeedbackSummary(req.query);
  res.status(200).json({
    success: true,
    message: "Feedback statistics retrieved successfully",
    data: result,
  });
});

// Function to delete feedback (soft delete) for admin
exports.deleteFeedback = catchAsync(async (req, res) => {
  const { feedbackId } = req.params;
  const result = await feedbackService.deleteFeedback(feedbackId);
  res.status(200).json({
    success: true,
    message: "Feedback deleted successfully",
    data: result,
  });
});

// Function to restore deleted feedback for admin
exports.restoreFeedback = catchAsync(async (req, res) => {
  const { feedbackId } = req.params;
  const result = await feedbackService.restoreFeedback(feedbackId);
  res.status(200).json({
    success: true,
    message: "Feedback restored successfully",
    data: result,
  });
});
