const livestreamCommentService = require('../services/livestreamCommentService');
const mongoose = require('mongoose');
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

// Add comment to livestream
exports.addComment = catchAsync(async (req, res) => {
    const { liveId, commentText } = req.body;
    const senderId = req.user.id;

    if (!liveId || !commentText) {
        throw new AppError('LiveId and commentText are required', 400);
    }

    if (commentText.length > 500) {
        throw new AppError('Comment text cannot exceed 500 characters', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId)) {
        throw new AppError('Invalid liveId format', 400);
    }

    const result = await livestreamCommentService.addComment(liveId, senderId, commentText);

    if (result.success) {
        res.status(200).json(result);
    } else {
        const statusCode = result.message === 'Livestream not found' ? 404 : 400;
        res.status(statusCode).json(result);
    }
});

// Get comments for a livestream (User - only non-deleted comments)
exports.getUserLiveComments = catchAsync(async (req, res) => {
    const { liveId } = req.params;
    const skip = parseInt(req.query.skip) || 0;
    let limit = parseInt(req.query.limit) || 50; // Default 50 for users
    const MAX_LIMIT = 100; // Max limit for performance safety

    if (!liveId) {
        throw new AppError('LiveId is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId)) {
        throw new AppError('Invalid liveId format', 400);
    }

    // Validate pagination params
    if (skip < 0 || limit < 0) {
        throw new AppError('Skip and limit must be non-negative integers', 400);
    }

    // Enforce max limit for performance optimization
    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }

    // Users can ONLY see non-deleted comments
    const result = await livestreamCommentService.getLiveComments(liveId, 'user', limit, skip);

    if (result.success) {
        const filteredComments = result.data.filter(comment => !comment.isDeleted);

        res.status(200).json({
            ...result,
            data: filteredComments,
            count: filteredComments.length
        });
    } else {
        res.status(400).json(result);
    }
});

// Get comments for a livestream (Admin - all comments, including deleted)
exports.getAdminLiveComments = catchAsync(async (req, res) => {
    const { liveId } = req.params;
    const skip = parseInt(req.query.skip) || 0;
    let limit = parseInt(req.query.limit) || 200; // Default 200 for admin
    const MAX_LIMIT = 500;

    if (!liveId) {
        throw new AppError('LiveId is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId)) {
        throw new AppError('Invalid liveId format', 400);
    }

    if (skip < 0 || limit < 0) {
        throw new AppError('Skip and limit must be non-negative integers', 400);
    }

    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }

    const result = await livestreamCommentService.getLiveComments(liveId, 'admin', limit, skip);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Delete comment
exports.hideComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!commentId) {
        throw new AppError('CommentId is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new AppError('Invalid commentId format', 400);
    }

    const result = await livestreamCommentService.hideComment(commentId, userId, userRole);

    if (result.success) {
        res.status(200).json(result);
    } else {
        const statusCode = result.error === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
        res.status(statusCode).json(result);
    }
});

// Pin comment
exports.pinComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const { liveId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!liveId || !commentId) {
        throw new AppError('LiveId and commentId are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(commentId)) {
        throw new AppError('Invalid liveId or commentId format', 400);
    }

    const result = await livestreamCommentService.pinComment(commentId, liveId, userId, userRole);

    if (result.success) {
        res.status(200).json(result);
    } else {
        const statusCode = result.message?.includes('permission') ? 403 : 400;
        res.status(statusCode).json(result);
    }
});

// Remove pin from comment
exports.removePinComment = catchAsync(async (req, res) => {
    const { commentId } = req.params;
    const { liveId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!liveId || !commentId) {
        throw new AppError('LiveId and commentId are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(commentId)) {
        throw new AppError('Invalid liveId or commentId format', 400);
    }

    const result = await livestreamCommentService.removePinComment(commentId, liveId, userId, userRole);

    if (result.success) {
        res.status(200).json(result);
    } else {
        const statusCode = result.message?.includes('permission') ? 403 : 400;
        res.status(statusCode).json(result);
    }
});
