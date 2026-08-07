const LiveComment = require('../models/LiveComment');
const LiveProduct = require('../models/LiveProduct');
const Livestream = require('../models/Livestream');
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
        await Livestream.findByIdAndUpdate(
            liveId,
            { $push: { liveCommentIds: liveComment._id } }
        );

        // Populate sender data (minimal fields for performance)
        await liveComment.populate({
            path: 'senderId',
            select: 'name username image' // Removed 'role' - not needed for display
        });

        // Emit realtime event with optimized payload (only necessary fields for websocket)
        // Ensure liveId is string for consistent comparison
        const liveIdStr = liveId?.toString?.() || String(liveId);
        const commentPayload = {
            _id: liveComment._id?.toString?.() || liveComment._id,
            liveId: liveComment.liveId?.toString?.() || liveComment.liveId,
            commentText: liveComment.commentText,
            createdAt: liveComment.createdAt,
            isPinned: liveComment.isPinned,
            isDeleted: false, // Always false for new comments
            sender: {
                _id: liveComment.senderId._id?.toString?.() || liveComment.senderId._id,
                name: liveComment.senderId.name,
                username: liveComment.senderId.username,
                image: liveComment.senderId.image
            }
        };

        getIO().to(`live_${liveIdStr}`).emit('comment:added', {
            liveId: liveIdStr,
            comment: commentPayload
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

// Get comments for a livestream (used in getLiveNow and direct API)
// Admin: see all (can use skip/limit for pagination), User: moderate limit (50) for performance
exports.getLiveComments = async (liveId, userRole = 'user', limit = 50, skip = 0) => {
    try {
        // Admin can see all comments, users ONLY see non-deleted
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const query = isAdmin
            ? { liveId }  // Admin: get all comments (including deleted)
            : { liveId, isDeleted: false };  // User: ONLY non-deleted

        // Get total count for reference
        const totalCount = await LiveComment.countDocuments(query);

        // WebSocket will push new comments real-time, so initial load doesn't need all
        const commentsQuery = LiveComment.find(query)
            .populate('senderId', 'name username image') // Removed 'role' - not needed for display
            .populate('deletedBy', 'name username') // Populate deletedBy for admin
            .sort({ isPinned: -1, createdAt: -1 }) // Pinned comments first, then by creation date
            .skip(parseInt(skip)) // Skip for pagination
            .lean(); // Use lean() early for better performance

        // Apply limit (for both admin and user when using pagination)
        if (limit > 0) {
            commentsQuery.limit(parseInt(limit));
        }

        const comments = await commentsQuery; // Already using lean() above

        return {
            success: true,
            message: 'Comments retrieved successfully',
            data: comments,
            count: comments.length,
            totalCount: totalCount, // Total available comments
            skip: parseInt(skip),
            limit: parseInt(limit),
            hasMore: skip + comments.length < totalCount // Are there more comments to load
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

        // Check permissions - Sender or Admin/Manager can hide comment
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const isSender = comment.senderId.toString() === userId.toString();

        if (!isAdmin && !isSender) {
            return {
                success: false,
                message: 'You do not have permission to hide this comment. Only the comment sender or admin/manager can hide comments.',
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
        // Ensure liveId is string for consistent comparison
        const liveIdStr = comment.liveId?.toString?.() || String(comment.liveId);
        const commentIdStr = commentId?.toString?.() || String(commentId);
        getIO().to(`live_${liveIdStr}`).emit('comment:deleted', {
            liveId: liveIdStr,
            commentId: commentIdStr
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

// Pin comment (admin only) - unpins all other comments in the livestream (products are independent)
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

        // IMPORTANT: Only allow 1 comment to be pinned at a time
        // Unpin all other comments in this livestream (ensure only 1 comment is pinned)
        // Get list of comments to be unpinned to emit events
        const commentsToUnpin = await LiveComment.find({
            liveId: liveId,
            isPinned: true,
            _id: { $ne: commentId },
            isDeleted: false
        }).select('_id');

        await LiveComment.updateMany(
            {
                liveId: liveId,
                isPinned: true, // Only unpin comments currently pinned
                _id: { $ne: commentId } // Exclude the comment being pinned
            },
            { isPinned: false }
        );

        // Ensure liveId is string for consistent comparison
        const liveIdStr = liveId?.toString?.() || String(liveId);
        const commentIdStr = commentId?.toString?.() || String(commentId);

        // Emit events for unpinned comments (for frontend UI update)
        // NOTE: Pin product and pin comment work independently, without affecting each other
        commentsToUnpin.forEach(commentToUnpin => {
            const unpinnedCommentId = commentToUnpin._id?.toString?.() || commentToUnpin._id;
            getIO().to(`live_${liveIdStr}`).emit('comment:unpinned', {
                liveId: liveIdStr,
                commentId: unpinnedCommentId,
                isPinned: false
            });
        });

        // Pin the specified comment
        comment.isPinned = true;
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');

        // Emit realtime event with optimized payload
        const pinnedPayload = {
            _id: comment._id?.toString?.() || comment._id,
            liveId: comment.liveId?.toString?.() || comment.liveId,
            commentText: comment.commentText,
            isPinned: true
        };

        getIO().to(`live_${liveIdStr}`).emit('comment:pinned', {
            liveId: liveIdStr,
            commentId: commentIdStr,
            comment: pinnedPayload
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

        // Unpin the comment
        comment.isPinned = false;
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');

        // Emit realtime event (minimal payload - only IDs)
        // Ensure liveId is string for consistent comparison
        const liveIdStr = liveId?.toString?.() || String(liveId);
        const commentIdStr = commentId?.toString?.() || String(commentId);
        getIO().to(`live_${liveIdStr}`).emit('comment:unpinned', {
            liveId: liveIdStr,
            commentId: commentIdStr,
            isPinned: false
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
