const livestreamReactionService = require('../services/livestreamReactionService');
const mongoose = require('mongoose');

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

// Get reaction counts for a livestream (User và Admin dùng chung)
// Trả về counts (aggregate) thay vì array - tối ưu performance
// Real-time updates qua WebSocket nên không cần pagination/limit
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

