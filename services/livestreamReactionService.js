const LiveReaction = require('../models/LiveReaction');
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

        // Create new reaction (allow multiple reactions per user in one livestream)
        const liveReaction = new LiveReaction({
            liveId,
            userId,
            reactionType,
            createdAt: new Date()
        });

        await liveReaction.save();

        // Update livestream's liveReactionIds array if it exists
        const Livestream = require('../models/Livestream');
        if (Livestream.schema.paths.liveReactionIds) {
            await Livestream.findByIdAndUpdate(
                liveId,
                { $push: { liveReactionIds: liveReaction._id } }
            );
        }

        // Populate user data
        await liveReaction.populate({
            path: 'userId',
            select: 'name username image role'
        });

        // Emit realtime event to all viewers
        getIO().to(`live_${liveId}`).emit('reaction:added', {
            liveId,
            reaction: liveReaction
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

// Get reactions for a livestream (no pagination)
exports.getLiveReactions = async (liveId) => {
    try {
        // Get all reactions (no deletion filter needed)
        const reactions = await LiveReaction.find({ liveId })
            .populate('userId', 'name username image role')
            .sort({ createdAt: -1 }); // Sort by creation date

        return {
            success: true,
            message: 'Reactions retrieved successfully',
            data: reactions,
            count: reactions.length
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to get reactions: ${error.message}`,
            error: error.message
        };
    }
};

