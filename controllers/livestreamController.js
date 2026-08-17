const livestreamService = require('../services/livestreamService');
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

// Start livestream (Admin)
exports.startLivestream = catchAsync(async (req, res) => {
    const { title, description } = req.body;
    const hostId = req.user.id;

    if (!title) {
        throw new AppError('Title is required', 400);
    }

    const result = await livestreamService.startLivestream(hostId, title, description);

    if (result.success) {
        const io = req.app.get('io');
        if (io) {
            const liveNowResult = await livestreamService.getLiveNow();
            const count = liveNowResult.data?.livestream ? 1 : 0;
            io.emit('livestreamCountChanged', {
                action: 'started',
                count: count
            });
        }

        const livestreamId = result.data?.livestreamId;
        await livestreamService.notifyLivestreamStarted(livestreamId, title, io);

        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// End livestream (Admin or Owner)
exports.endLivestream = catchAsync(async (req, res) => {
    const { livestreamId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!livestreamId) {
        throw new AppError('Livestream ID is required', 400);
    }

    const result = await livestreamService.endLivestream(livestreamId, userId, userRole);

    if (result.success) {
        const io = req.app.get('io');
        if (io) {
            const liveNowResult = await livestreamService.getLiveNow();
            const count = liveNowResult.data?.livestream ? 1 : 0;
            io.emit('livestreamCountChanged', {
                action: 'ended',
                count: count
            });
        }
        res.status(200).json(result);
    } else {
        const statusCode = result.error === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
        res.status(statusCode).json(result);
    }
});

// View livestream (User or Staff)
exports.joinLivestream = catchAsync(async (req, res) => {
    const { livestreamId } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;
    const userRole = req.user.role;

    if (!livestreamId) {
        throw new AppError('Livestream ID is required', 400);
    }

    const result = await livestreamService.joinLivestream(livestreamId, userId, userName, userRole);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get live streams (User)
exports.getLiveStreams = catchAsync(async (req, res) => {
    const result = await livestreamService.getLiveStreams();

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get host livestreams (Admin)
exports.getHostLivestreams = catchAsync(async (req, res) => {
    const hostId = req.user.id;
    const result = await livestreamService.getHostLivestreams(hostId);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get host token for a livestream (Admin)
exports.getHostToken = catchAsync(async (req, res) => {
    const { roomName } = req.body;
    const hostId = req.user.id;

    if (!roomName) {
        throw new AppError('Room name is required', 400);
    }

    const result = await livestreamService.getHostToken(roomName, hostId);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get all livestreams (User/Admin)
exports.getAllLive = catchAsync(async (req, res) => {
    const result = await livestreamService.getAllLive();

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get specific livestream details (Admin only)
exports.getLiveById = catchAsync(async (req, res) => {
    const { livestreamId } = req.params;
    const userRole = req.user.role;

    if (!livestreamId) {
        throw new AppError('Livestream ID is required', 400);
    }

    const result = await livestreamService.getLiveById(livestreamId, userRole);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(404).json(result);
    }
});

// Leave livestream (User)
exports.leaveLivestream = catchAsync(async (req, res) => {
    const { livestreamId } = req.body;
    const userId = req.user.id;

    if (!livestreamId) {
        throw new AppError('Livestream ID is required', 400);
    }

    const result = await livestreamService.leaveLivestream(livestreamId, userId);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get currently live streams (User/Admin)
exports.getLiveNow = catchAsync(async (req, res) => {
    const result = await livestreamService.getLiveNow();

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(400).json(result);
    }
});