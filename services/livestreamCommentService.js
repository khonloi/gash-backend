const LiveComment = require('../models/liveComment');
const LiveProduct = require('../models/liveProduct');
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
        const commentPayload = {
            _id: liveComment._id,
            liveId: liveComment.liveId,
            commentText: liveComment.commentText,
            createdAt: liveComment.createdAt,
            isPinned: liveComment.isPinned,
            isDeleted: false, // Always false for new comments
            sender: {
                _id: liveComment.senderId._id,
                name: liveComment.senderId.name,
                username: liveComment.senderId.username,
                image: liveComment.senderId.image
            }
        };

        getIO().to(`live_${liveId}`).emit('comment:added', {
            liveId,
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
// Admin: xem hết (có thể dùng skip/limit cho pagination), User: limit vừa phải (50) cho performance
exports.getLiveComments = async (liveId, userRole = 'user', limit = 50, skip = 0) => {
    try {
        // Admin can see all comments, users ONLY see non-deleted (CHỈ TRẢ VỀ CMT KO BỊ DELETE)
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const query = isAdmin
            ? { liveId }  // Admin: get all comments (including deleted)
            : { liveId, isDeleted: false };  // User: CHỈ non-deleted (bắt buộc filter)

        // Get total count for reference
        const totalCount = await LiveComment.countDocuments(query);

        // WebSocket sẽ push comments mới real-time, nên initial load không cần tất cả
        const commentsQuery = LiveComment.find(query)
            .populate('senderId', 'name username image') // Removed 'role' - not needed for display
            .populate('deletedBy', 'name username') // Populate deletedBy for admin
            .populate('pinBy', 'name username') // Removed 'role' - not needed
            .populate('unpinBy', 'name username') // Removed 'role' - not needed
            .sort({ isPinned: -1, createdAt: -1 }) // Pinned comments first, then by creation date
            .skip(parseInt(skip)) // Skip for pagination
            .lean(); // Use lean() early for better performance

        // Apply limit (cho cả admin và user khi dùng pagination)
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
            hasMore: skip + comments.length < totalCount // Còn comments để load thêm không
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

        // Check permissions - Sender hoặc Admin/Manager có thể hide comment
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

        // QUAN TRỌNG: Chỉ cho phép 1 comment được pin tại 1 thời điểm
        // Unpin tất cả comments khác trong livestream này (đảm bảo chỉ có 1 comment pinned)
        // Lấy danh sách comments sẽ bị unpin để emit events
        const commentsToUnpin = await LiveComment.find({
            liveId: liveId,
            isPinned: true,
            _id: { $ne: commentId },
            isDeleted: false
        }).select('_id');

        await LiveComment.updateMany(
            {
                liveId: liveId,
                isPinned: true, // Chỉ unpin các comment đang được pin
                _id: { $ne: commentId } // Exclude the comment being pinned
            },
            { isPinned: false, unpinBy: userId }
        );

        // Unpin tất cả products trong livestream (vì chỉ có thể pin comment HOẶC product, không thể cả 2)
        await LiveProduct.updateMany(
            {
                liveId: liveId,
                isPinned: true // Chỉ unpin các product đang được pin
            },
            { isPinned: false, unpinBy: userId }
        );

        // Emit events cho các comments/products bị unpin (để frontend cập nhật UI)
        commentsToUnpin.forEach(commentToUnpin => {
            getIO().to(`live_${liveId}`).emit('comment:unpinned', {
                liveId,
                commentId: commentToUnpin._id,
                isPinned: false
            });
        });

        // Pin the specified comment
        comment.isPinned = true;
        comment.pinBy = userId;
        comment.unpinBy = null;
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');
        await comment.populate('pinBy', 'name username role');

        // Emit realtime event with optimized payload
        const pinnedPayload = {
            _id: comment._id,
            liveId: comment.liveId,
            commentText: comment.commentText,
            isPinned: true,
            pinnedBy: {
                _id: comment.pinBy._id,
                name: comment.pinBy.name,
                username: comment.pinBy.username
            }
        };

        getIO().to(`live_${liveId}`).emit('comment:pinned', {
            liveId,
            commentId: commentId,
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

        // Unpin the comment (keep pinBy for statistics)
        comment.isPinned = false;
        comment.unpinBy = userId;
        // Keep pinBy to track who originally pinned it
        await comment.save();

        // Populate comment data
        await comment.populate('senderId', 'name username image role');
        await comment.populate('deletedBy', 'name username');
        await comment.populate('unpinBy', 'name username role');

        // Emit realtime event (minimal payload - only IDs)
        getIO().to(`live_${liveId}`).emit('comment:unpinned', {
            liveId,
            commentId: commentId,
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
