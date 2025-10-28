const LiveComment = require('../models/LiveComment');
const { getIO } = require('../sockets/productSocket');

// Add comment to livestream
exports.addComment = async (liveId, senderId, commentText) => {
    try {
        // Validate inputs
        if (!liveId || !senderId || !commentText) {
            return {
                success: false,
                message: 'LiveId, senderId, and commentText are required',
            };
        }

        // Create new live comment
        const liveComment = new LiveComment({
            liveId,
            senderId,
            commentText,
            createdAt: new Date()
        });

        await liveComment.save();

        // Update livestream's liveCommentIds array
        const Livestream = require('../models/Livestream');
        await Livestream.findByIdAndUpdate(
            liveId,
            { $push: { liveCommentIds: liveComment._id } }
        );

        // Populate sender data
        await liveComment.populate({
            path: 'senderId',
            select: 'name username image role'
        });

        // Emit realtime event to all viewers
        getIO().to(`live_${liveId}`).emit('comment:added', {
            liveId,
            comment: liveComment
        });

        return {
            success: true,
            message: 'Comment added successfully',
            data: liveComment
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to add comment: ${error.message}`,
            error: error.message
        };
    }
};

// Get comments for a livestream (no pagination)
exports.getLiveComments = async (liveId, userRole = 'user') => {
    try {
        // Admin can see all comments, users only see non-deleted
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const query = isAdmin
            ? { liveId }  // Admin: get all comments
            : { liveId, isDeleted: false };  // User: only non-deleted

        const comments = await LiveComment.find(query)
            .populate('senderId', 'name username image role')
            .populate('deletedBy', 'name username') // Populate deletedBy for admin
            .populate('pinBy', 'name username role') // Populate pinBy
            .populate('unpinBy', 'name username role') // Populate unpinBy
            .sort({ isPinned: -1, createdAt: -1 }); // Pinned comments first, then by creation date

        return {
            success: true,
            message: 'Comments retrieved successfully',
            data: comments,
            count: comments.length
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to get comments: ${error.message}`,
            error: error.message
        };
    }
};

// Delete comment (soft delete - only sender or admin)
exports.hideComment = async (commentId, userId, userRole) => {
    try {
        const comment = await LiveComment.findById(commentId);

        if (!comment) {
            return {
                success: false,
                message: 'Comment not found',
            };
        }

        // Check if already deleted
        if (comment.isDeleted) {
            return {
                success: false,
                message: 'Comment has already been deleted',
            };
        }

        // Check permissions
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const isSender = comment.senderId.toString() === userId.toString();

        if (!isAdmin && !isSender) {
            return {
                success: false,
                message: 'You do not have permission to delete this comment',
            };
        }

        // Soft delete - update instead of removing
        comment.isDeleted = true;
        comment.deletedAt = new Date();
        comment.deletedBy = userId;
        await comment.save();

        // Populate deletedBy to return user info
        await comment.populate('deletedBy', 'name username role');

        // Emit realtime event to all viewers
        getIO().to(`live_${comment.liveId}`).emit('comment:deleted', {
            liveId: comment.liveId,
            commentId: commentId
        });

        return {
            success: true,
            message: 'Comment deleted successfully',
            data: {
                commentId: commentId,
                deletedAt: comment.deletedAt,
                deletedBy: comment.deletedBy
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to delete comment: ${error.message}`,
            error: error.message
        };
    }
};

// Pin comment (admin only) - unpins all other comments and products in the livestream
exports.pinComment = async (commentId, liveId, userId, userRole) => {
    try {
        // Check permissions - only admin/manager can pin
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        if (!isAdmin) {
            return {
                success: false,
                message: 'Only admin or manager can pin comments',
            };
        }

        // Verify comment exists, belongs to the livestream, and is not deleted
        const comment = await LiveComment.findOne({
            _id: commentId,
            liveId: liveId,
            isDeleted: false
        });

        if (!comment) {
            return {
                success: false,
                message: 'Comment not found or has been deleted. Only non-deleted comments can be pinned.',
            };
        }

        // Check if comment is already pinned
        if (comment.isPinned) {
            return {
                success: false,
                message: 'Comment is already pinned',
            };
        }

        // Unpin all other comments and products in this livestream (exclude the one being pinned)
        await LiveComment.updateMany(
            {
                liveId: liveId,
                _id: { $ne: commentId } // Exclude the comment being pinned
            },
            { isPinned: false, unpinBy: userId }
        );

        const LiveProduct = require('../models/LiveProduct');
        await LiveProduct.updateMany(
            { liveId: liveId },
            { isPinned: false, unpinBy: userId }
        );

        // Pin the specified comment
        comment.isPinned = true;
        comment.pinBy = userId;
        comment.unpinBy = null;
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');
        await comment.populate('pinBy', 'name username role');

        // Emit realtime event
        getIO().to(`live_${liveId}`).emit('comment:pinned', {
            liveId,
            commentId: commentId,
            comment: comment
        });

        return {
            success: true,
            message: 'Comment pinned successfully',
            data: comment
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to pin comment: ${error.message}`,
            error: error.message
        };
    }
};

// Remove pin from comment (admin only)
exports.removePinComment = async (commentId, liveId, userId, userRole) => {
    try {
        // Check permissions - only admin/manager can unpin
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        if (!isAdmin) {
            return {
                success: false,
                message: 'Only admin or manager can unpin comments',
            };
        }

        // Verify comment exists and belongs to the livestream
        const comment = await LiveComment.findOne({
            _id: commentId,
            liveId: liveId
        });

        if (!comment) {
            return {
                success: false,
                message: 'Comment not found in this livestream',
            };
        }

        // Check if comment is not pinned
        if (!comment.isPinned) {
            return {
                success: false,
                message: 'Comment is not pinned',
            };
        }

        // Unpin the comment (keep pinBy for statistics)
        comment.isPinned = false;
        comment.unpinBy = userId;
        // Keep pinBy to track who originally pinned it
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');
        await comment.populate('unpinBy', 'name username role');

        // Emit realtime event
        getIO().to(`live_${liveId}`).emit('comment:unpinned', {
            liveId,
            commentId: commentId
        });

        return {
            success: true,
            message: 'Comment unpinned successfully',
            data: comment
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to unpin comment: ${error.message}`,
            error: error.message
        };
    }
};
