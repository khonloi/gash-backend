const LiveReaction = require('../models/LiveReaction');
const Livestream = require('../models/Livestream');
const mongoose = require('mongoose');
const { getIO } = require('../sockets/productSocket');

// Add reaction to livestream
exports.addReaction = async (liveId, userId, reactionType) => {
    try {
        // Validate inputs
        if (!liveId || !userId || !reactionType) {
            return {
                success: false,
                message: 'LiveId, userId, and reactionType are required',
            };
        }

        // Validate reactionType
        const validReactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        if (!validReactionTypes.includes(reactionType)) {
            return {
                success: false,
                message: 'Invalid reactionType. Must be one of: like, love, haha, wow, sad, angry',
            };
        }

        const livestream = await Livestream.findById(liveId);
        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        if (livestream.status === 'ended') {
            return {
                success: false,
                message: 'Cannot react to ended livestream'
            };
        }

        // Create new reaction (allow multiple reactions per user in one livestream)
        const liveReaction = new LiveReaction({
            liveId,
            userId,
            reactionType,
            createdAt: new Date()
        });

        await liveReaction.save();

        // Update livestream's liveReactionIds array if it exists
        if (Livestream.schema.paths.liveReactionIds) {
            await Livestream.findByIdAndUpdate(
                liveId,
                { $push: { liveReactionIds: liveReaction._id } }
            );
        }

        // Populate user data (minimal for websocket)
        await liveReaction.populate({
            path: 'userId',
            select: 'name username image' // Removed 'role' - not needed for display
        });

        // Emit realtime event with optimized payload (only necessary fields)
        // Ensure liveId is string for consistent comparison
        const liveIdStr = liveId?.toString?.() || String(liveId);
        const reactionPayload = {
            _id: liveReaction._id?.toString?.() || liveReaction._id,
            reactionType: liveReaction.reactionType,
            createdAt: liveReaction.createdAt,
            user: {
                _id: liveReaction.userId._id?.toString?.() || liveReaction.userId._id,
                name: liveReaction.userId.name,
                username: liveReaction.userId.username,
                image: liveReaction.userId.image
            }
        };

        getIO().to(`live_${liveIdStr}`).emit('reaction:added', {
            liveId: liveIdStr,
            reaction: reactionPayload
        });

        return {
            success: true,
            message: 'Reaction added successfully',
            data: liveReaction
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to add reaction: ${error.message}`,
            error: error.message
        };
    }
};

// Get reaction counts for a livestream (Shared by User and Admin - since reactions are not deleted)
// Returns counts (aggregate) instead of full array for performance optimization
// Real-time updates via WebSocket so no pagination/limit needed
exports.getLiveReactions = async (liveId) => {
    try {
        // Get reaction counts by type (aggregate)
        const reactionStats = await LiveReaction.aggregate([
            { $match: { liveId: new mongoose.Types.ObjectId(liveId) } },
            { $group: { _id: '$reactionType', count: { $sum: 1 } } }
        ]);

        // Convert to object format with all reaction types
        const reactions = reactionStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 });

        // Calculate total reactions
        const total = Object.values(reactions).reduce((sum, count) => sum + count, 0);

        return {
            success: true,
            message: 'Reactions retrieved successfully',
            data: {
                reactions: {
                    ...reactions,
                    total: total
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to get reactions: ${error.message}`,
            error: error.message
        };
    }
};

