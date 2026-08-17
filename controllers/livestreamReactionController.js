const livestreamReactionService = require('../services/livestreamReactionService');
const mongoose = require('mongoose');
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

// Add reaction to livestream
exports.addReaction = catchAsync(async (req, res) => {
    const { liveId, reactionType } = req.body;
    const userId = req.user.id;

    if (!liveId || !reactionType) {
        throw new AppError('LiveId and reactionType are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId)) {
        throw new AppError('Invalid liveId format', 400);
    }

    const result = await livestreamReactionService.addReaction(liveId, userId, reactionType);

    if (result.success) {
        res.status(200).json(result);
    } else {
        const statusCode = result.message === 'Livestream not found' ? 404 : 400;
        res.status(statusCode).json(result);
    }
});

// Get reaction counts for a livestream (Shared by User and Admin)
exports.getLiveReactions = catchAsync(async (req, res) => {
    const { liveId } = req.params;

    if (!liveId) {
        throw new AppError('LiveId is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(liveId)) {
        throw new AppError('Invalid liveId format', 400);
    }

    const result = await livestreamReactionService.getLiveReactions(liveId);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});
