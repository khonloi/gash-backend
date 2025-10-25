const livekitService = require('../services/livekitService');

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

        const result = await livekitService.startLivestream(hostId, title, description);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in startLivestream controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// End livestream (Admin)
exports.endLivestream = async (req, res) => {
    try {
        const { livestreamId } = req.body;

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        const result = await livekitService.endLivestream(livestreamId);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in endLivestream controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// View livestream (User) - renamed from joinLivestream
exports.joinLivestream = async (req, res) => {
    try {
        const { livestreamId } = req.body;
        const userId = req.user.id;
        const userName = req.user.username;

        if (!livestreamId) {
            return res.status(400).json({
                success: false,
                message: 'Livestream ID is required'
            });
        }

        const result = await livekitService.joinLivestream(livestreamId, userId, userName);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in joinLivestream controller:', error);
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
        const result = await livekitService.getLiveStreams();

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in getLiveStreams controller:', error);
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
        const result = await livekitService.getHostLivestreams(hostId);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in getHostLivestreams controller:', error);
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

        const result = await livekitService.getHostToken(roomName, hostId);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error in getHostToken controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};