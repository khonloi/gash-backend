const { generateAccessToken, createRoom, deleteRoom } = require('../config/livekit');
const Livestream = require('../models/Livestream');

// Start livestream (Admin)
exports.startLivestream = async (hostId, title, description) => {
    try {
        // Generate unique room name
        const roomName = `livestream_${hostId}_${Date.now()}`;

        // Create LiveKit room
        const roomResult = await createRoom(roomName, {
            maxParticipants: 100,
            emptyTimeout: 300
        });

        if (!roomResult.success) {
            throw new Error(roomResult.message);
        }

        // Create livestream record in database
        const livestream = new Livestream({
            hostId: hostId,
            title: title,
            description: description,
            roomName: roomName,
            status: 'live',
            platform: 'livekit',
            startTime: new Date()
        });

        await livestream.save();

        // Generate host access token
        const hostToken = generateAccessToken(roomName, 'Host', hostId, true);

        return {
            success: true,
            message: 'Livestream started successfully',
            data: {
                livestreamId: livestream._id,
                roomName: roomName,
                hostToken: hostToken,
                hostId: hostId,
                title: title,
                description: description,
                status: 'live',
                startTime: livestream.startTime
            }
        };

    } catch (error) {
        console.error('Error starting livestream:', error);
        return {
            success: false,
            message: `Failed to start livestream: ${error.message}`,
            error: error.message
        };
    }
};

// End livestream (Admin)
exports.endLivestream = async (livestreamId) => {
    try {
        // Find livestream
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) {
            throw new Error('Livestream not found');
        }

        if (livestream.status !== 'live') {
            throw new Error('Livestream is not currently live');
        }

        // Delete LiveKit room
        const deleteResult = await deleteRoom(livestream.roomName);
        if (!deleteResult.success) {
            console.warn('Failed to delete LiveKit room:', deleteResult.message);
        }

        // Update livestream status
        livestream.status = 'ended';
        livestream.endTime = new Date();
        await livestream.save();

        return {
            success: true,
            message: 'Livestream ended successfully',
            data: {
                livestreamId: livestream._id,
                status: 'ended',
                endTime: livestream.endTime,
                duration: livestream.endTime - livestream.startTime
            }
        };

    } catch (error) {
        console.error('Error ending livestream:', error);
        return {
            success: false,
            message: `Failed to end livestream: ${error.message}`,
            error: error.message
        };
    }
};

// Join livestream (User)
exports.joinLivestream = async (livestreamId, userId, userName) => {
    try {
        // Find livestream
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) {
            throw new Error('Livestream not found');
        }

        if (livestream.status !== 'live') {
            throw new Error('Livestream is not currently live');
        }

        // Generate viewer access token
        const viewerToken = generateAccessToken(livestream.roomName, userName, userId, false);

        // Update viewer count (simple)
        livestream.currentViewers = (livestream.currentViewers || 0) + 1;
        await livestream.save();

        return {
            success: true,
            message: 'Joined livestream successfully',
            data: {
                livestreamId: livestream._id,
                roomName: livestream.roomName,
                viewerToken: viewerToken,
                userId: userId,
                userName: userName,
                title: livestream.title,
                description: livestream.description,
                hostId: livestream.hostId,
                currentViewers: livestream.currentViewers,
                joinedAt: new Date()
            }
        };

    } catch (error) {
        console.error('Error joining livestream:', error);
        return {
            success: false,
            message: `Failed to join livestream: ${error.message}`,
            error: error.message
        };
    }
};


// Get live streams
exports.getLiveStreams = async () => {
    try {
        const livestreams = await Livestream.find({ status: 'live' })
            .select('_id hostId title description roomName startTime currentViewers')
            .sort({ startTime: -1 });

        return {
            success: true,
            message: 'Live streams retrieved successfully',
            data: {
                streams: livestreams,
                count: livestreams.length
            }
        };

    } catch (error) {
        console.error('Error getting live streams:', error);
        return {
            success: false,
            message: `Failed to get live streams: ${error.message}`,
            error: error.message
        };
    }
};


// Get host livestreams
exports.getHostLivestreams = async (hostId) => {
    try {
        const livestreams = await Livestream.find({ hostId: hostId })
            .select('_id title description roomName status startTime endTime currentViewers')
            .sort({ startTime: -1 });

        return {
            success: true,
            message: 'Host livestreams retrieved successfully',
            data: {
                livestreams: livestreams,
                count: livestreams.length
            }
        };

    } catch (error) {
        console.error('Error getting host livestreams:', error);
        return {
            success: false,
            message: `Failed to get host livestreams: ${error.message}`,
            error: error.message
        };
    }
};

// Get host token for a livestream
exports.getHostToken = async (roomName, hostId) => {
    try {
        const token = generateAccessToken(roomName, 'Host', hostId, true);

        return {
            success: true,
            message: 'Host token generated successfully',
            data: {
                token: token
            }
        };

    } catch (error) {
        console.error('Error generating host token:', error);
        return {
            success: false,
            message: `Failed to generate host token: ${error.message}`,
            error: error.message
        };
    }
};