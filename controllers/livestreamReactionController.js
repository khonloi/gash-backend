const livestreamReactionService = require('../services/livestreamReactionService');
const mongoose = require('mongoose');
const Livestream = require('../models/Livestream');

// Add reaction to livestream
exports.addReaction = async (req, res) => {
    try {
        const { liveId, reactionType } = req.body;
        const userId = req.user.id;

        if (!liveId || !reactionType) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and reactionType are required'
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
                message: 'Cannot react to ended livestream'
            });
        }

        const result = await livestreamReactionService.addReaction(liveId, userId, reactionType);

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

// Get reaction counts for a livestream (Shared by User and Admin)
// Returns counts (aggregate) instead of array - performance optimization
// Real-time updates via WebSocket so no pagination/limit needed
exports.getLiveReactions = async (req, res) => {
    try {
        const { liveId } = req.params;

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

        const result = await livestreamReactionService.getLiveReactions(liveId);

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

