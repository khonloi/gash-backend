const livestreamService = require('../services/livestreamService');

// Start livestream (Admin)
exports.startLivestream = async (req, res) => {
    try {
        const { title, description } = req.body;
        const hostId = req.user.id;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        const result = await livestreamService.startLivestream(hostId, title, description);

        if (result.success) {
            // 🔔 Emit Socket.IO event for livestream count update
            const io = req.app.get('io');
            if (io) {
                // Get actual count (should be 1 after starting)
                const liveNowResult = await livestreamService.getLiveNow();
                const count = liveNowResult.data?.livestream ? 1 : 0;
                io.emit('livestreamCountChanged', {
                    action: 'started',
                    count: count
                });
            }
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

// End livestream (Admin or Owner)
exports.endLivestream = async (req, res) => {
    try {
        const { livestreamId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        const result = await livestreamService.endLivestream(livestreamId, userId, userRole);

        if (result.success) {
            // 🔔 Emit Socket.IO event for livestream count update
            const io = req.app.get('io');
            if (io) {
                // Get actual count (should be 0 after ending)
                const liveNowResult = await livestreamService.getLiveNow();
                const count = liveNowResult.data?.livestream ? 1 : 0;
                io.emit('livestreamCountChanged', {
                    action: 'ended',
                    count: count
                });
            }
            res.status(200).json(result);
        } else {
            // Return 403 for permission errors, 400 for other errors
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

// View livestream (User hoặc Staff)
exports.joinLivestream = async (req, res) => {
    try {
        const { livestreamId } = req.body;
        const userId = req.user.id;
        const userName = req.user.username;
        const userRole = req.user.role; // Lấy role để phân biệt staff vs user

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        const result = await livestreamService.joinLivestream(livestreamId, userId, userName, userRole);

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

// Get live streams (User)
exports.getLiveStreams = async (req, res) => {
    try {
        const result = await livestreamService.getLiveStreams();

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

// Get host livestreams (Admin)
exports.getHostLivestreams = async (req, res) => {
    try {
        const hostId = req.user.id;
        const result = await livestreamService.getHostLivestreams(hostId);

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

// Get host token for a livestream (Admin)
exports.getHostToken = async (req, res) => {
    try {
        const { roomName } = req.body;
        const hostId = req.user.id;

        if (!roomName) {
            return res.status(400).json({
                success: false,
                message: 'Room name is required'
            });
        }

        const result = await livestreamService.getHostToken(roomName, hostId);

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

// Get all livestreams (User/Admin)
exports.getAllLive = async (req, res) => {
    try {
        const result = await livestreamService.getAllLive();

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

// Get specific livestream details (Admin only)
exports.getLiveById = async (req, res) => {
    try {
        const { livestreamId } = req.params;
        const userRole = req.user.role; // Admin/manager only (enforced by route middleware)

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        // Pass userRole to service
        const result = await livestreamService.getLiveById(livestreamId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(404).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Leave livestream (User)
exports.leaveLivestream = async (req, res) => {
    try {
        const { livestreamId } = req.body;
        const userId = req.user.id;

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        const result = await livestreamService.leaveLivestream(livestreamId, userId);

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

// Get currently live streams (User/Admin)
exports.getLiveNow = async (req, res) => {
    try {
        const result = await livestreamService.getLiveNow();

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