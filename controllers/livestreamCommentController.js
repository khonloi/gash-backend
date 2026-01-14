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
// Default limit: 50 (tối ưu performance cho user)
// Max limit: 100 (bảo vệ server khỏi request quá lớn)
exports.getUserLiveComments = async (req, res) => {
    try {
        const { liveId } = req.params;
        const skip = parseInt(req.query.skip) || 0;
        let limit = parseInt(req.query.limit) || 50; // Default 50 for users
        const MAX_LIMIT = 100; // Max limit để bảo vệ performance

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

        // Enforce max limit để tối ưu performance
        if (limit > MAX_LIMIT) {
            limit = MAX_LIMIT;
        }

        // Users can ONLY see non-deleted comments (CHỈ TRẢ VỀ CMT KO BỊ DELETE)
        const result = await livestreamCommentService.getLiveComments(liveId, 'user', limit, skip);

        if (result.success) {
            // Double-check: Filter out any deleted comments (phòng ngừa - đảm bảo 100% không có deleted)
            const filteredComments = result.data.filter(comment => !comment.isDeleted);

            res.status(200).json({
                ...result,
                data: filteredComments, // CHỈ TRẢ VỀ CMT KO BỊ DELETE
                count: filteredComments.length // Update count after filter
                // totalCount giữ nguyên từ service (đã đúng với query isDeleted: false)
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
// Default limit: 200 (tối ưu cho admin dashboard - xem được nhiều hơn user)
// Max limit: 500 (bảo vệ server khỏi request quá lớn, có thể load more nếu cần)
exports.getAdminLiveComments = async (req, res) => {
    try {
        const { liveId } = req.params;
        const skip = parseInt(req.query.skip) || 0;
        let limit = parseInt(req.query.limit) || 200; // Default 200 for admin (nhiều hơn user)
        const MAX_LIMIT = 500; // Max limit để bảo vệ performance

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

        // Enforce max limit để tối ưu performance (admin có thể load more nếu cần)
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
