const livestreamCommentService = require('../services/livestreamCommentService');
const mongoose = require('mongoose');
const Livestream = require('../models/Livestream');

// Add comment to livestream
exports.addComment = async (req, res) => {
    try {
        const { liveId, commentText } = req.body;
        const senderId = req.user.id;

        if (!liveId || !commentText) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and commentText are required'
            });
        }

        if (commentText.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Comment text cannot exceed 500 characters'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId format'
            });
        }

        // Check if livestream exists and is not ended
        const livestream = await Livestream.findById(liveId);
        if (!livestream) {
            return res.status(404).json({
                success: false,
                message: 'Livestream not found'
            });
        }

        if (livestream.status === 'ended') {
            return res.status(400).json({
                success: false,
                message: 'Cannot comment on ended livestream'
            });
        }

        const result = await livestreamCommentService.addComment(liveId, senderId, commentText);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get comments for a livestream (User - only non-deleted comments)
// Supports pagination with query params: ?skip=0&limit=50
// Default limit: 50 (performance optimization for user)
// Max limit: 100 (protect server from overly large requests)
exports.getUserLiveComments = async (req, res) => {
    try {
        const { liveId } = req.params;
        const skip = parseInt(req.query.skip) || 0;
        let limit = parseInt(req.query.limit) || 50; // Default 50 for users
        const MAX_LIMIT = 100; // Max limit for performance safety

        if (!liveId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId format'
            });
        }

        // Validate pagination params
        if (skip < 0 || limit < 0) {
            return res.status(400).json({
                success: false,
                message: 'Skip and limit must be non-negative integers'
            });
        }

        // Enforce max limit for performance optimization
        if (limit > MAX_LIMIT) {
            limit = MAX_LIMIT;
        }

        // Users can ONLY see non-deleted comments
        const result = await livestreamCommentService.getLiveComments(liveId, 'user', limit, skip);

        if (result.success) {
            // Double-check: Filter out any deleted comments (precautionary - ensure 100% no deleted)
            const filteredComments = result.data.filter(comment => !comment.isDeleted);

            res.status(200).json({
                ...result,
                data: filteredComments, // ONLY RETURN NON-DELETED COMMENTS
                count: filteredComments.length // Update count after filter
                // totalCount remains from service (already correct for isDeleted: false)
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get comments for a livestream (Admin - all comments, including deleted)
// Supports pagination with query params: ?skip=0&limit=200
// Default limit: 200 (optimized for admin dashboard - see more than user)
// Max limit: 500 (protect server from overly large requests, can load more if needed)
exports.getAdminLiveComments = async (req, res) => {
    try {
        const { liveId } = req.params;
        const skip = parseInt(req.query.skip) || 0;
        let limit = parseInt(req.query.limit) || 200; // Default 200 for admin (more than user)
        const MAX_LIMIT = 500; // Max limit for performance safety

        if (!liveId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId format'
            });
        }

        // Validate pagination params
        if (skip < 0 || limit < 0) {
            return res.status(400).json({
                success: false,
                message: 'Skip and limit must be non-negative integers'
            });
        }

        // Enforce max limit for performance optimization (admin can load more if needed)
        if (limit > MAX_LIMIT) {
            limit = MAX_LIMIT;
        }

        // Admin can see all comments (including deleted)
        const result = await livestreamCommentService.getLiveComments(liveId, 'admin', limit, skip);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete comment
exports.hideComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!commentId) {
            return res.status(400).json({
                success: false,
                message: 'CommentId is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid commentId format'
            });
        }

        const result = await livestreamCommentService.hideComment(commentId, userId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Pin comment
exports.pinComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { liveId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!liveId || !commentId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and commentId are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or commentId format'
            });
        }

        const result = await livestreamCommentService.pinComment(commentId, liveId, userId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.message.includes('permission') ? 403 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove pin from comment
exports.removePinComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { liveId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!liveId || !commentId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and commentId are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or commentId format'
            });
        }

        const result = await livestreamCommentService.removePinComment(commentId, liveId, userId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.message.includes('permission') ? 403 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
