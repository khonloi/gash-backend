const livestreamCommentService = require('../services/livestreamCommentService');
const mongoose = require('mongoose');

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

// Get comments for a livestream (User - only non-deleted comments, Admin - all comments)
exports.getUserLiveComments = async (req, res) => {
    try {
        const { liveId } = req.params;
        const userRole = req.user.role;

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

        // Admin/manager can see all comments, users can only see non-deleted comments
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const role = isAdmin ? 'admin' : 'user';
        const result = await livestreamCommentService.getLiveComments(liveId, role);

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
