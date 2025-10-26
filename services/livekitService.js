const { generateAccessToken, createRoom, deleteRoom, roomService } = require('../config/livekit');
const Livestream = require('../models/Livestream');

// Get real-time viewer count from LiveKit
const getRealTimeViewers = async (roomName) => {
    try {
        const room = await roomService.getRoom(roomName);
        if (!room) return 0;

        const participants = room.participants || [];
        console.log('🔍 Room participants:', participants.map(p => ({ identity: p.identity, name: p.name })));

        // Exclude host from viewer count (host is broadcaster, not viewer)
        const viewers = participants.filter(p => p.identity !== 'Host').length;
        console.log('👥 Real-time viewers (excluding host):', viewers);
        return viewers;
    } catch (error) {
        console.error('Error getting real-time viewers:', error);
        return 0;
    }
};

// Update peak and min viewers
const updateViewerStats = async (livestreamId, currentViewers) => {
    try {
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) return;

        // Update peak viewers (always increase, never decrease)
        if (currentViewers > livestream.peakViewers) {
            livestream.peakViewers = currentViewers;
        }

        // Update min viewers (only if livestream is live and has viewers)
        if (livestream.status === 'live' && currentViewers > 0) {
            if (livestream.minViewers === 0 || currentViewers < livestream.minViewers) {
                livestream.minViewers = currentViewers;
            }
        }

        await livestream.save();
    } catch (error) {
        console.error('Error updating viewer stats:', error);
    }
};

// Start livestream (Admin)
exports.startLivestream = async (hostId, title, description) => {
    try {
        // Check: One person can only start one livestream
        const userActiveStream = await Livestream.findOne({
            hostId: hostId,
            status: 'live'
        });
        if (userActiveStream) {
            return {
                success: false,
                message: 'You already have an active livestream. Please end your current livestream before starting a new one.',
                error: 'USER_ALREADY_LIVE',
                data: {
                    userLivestream: {
                        id: userActiveStream._id,
                        title: userActiveStream.title,
                        startTime: userActiveStream.startTime
                    }
                }
            };
        }

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
            startTime: new Date(),
            currentViewers: 0,
            peakViewers: 0,
            minViewers: 0
        });

        await livestream.save();

        // Generate host access token
        const hostToken = generateAccessToken(roomName, 'Host', 'Host', true);

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

// End livestream (Admin or Owner)
exports.endLivestream = async (livestreamId, userId, userRole) => {
    try {
        // Validate ObjectId format
        if (!livestreamId || !livestreamId.match(/^[0-9a-fA-F]{24}$/)) {
            return {
                success: false,
                message: 'Invalid livestream ID format'
            };
        }

        // Find livestream
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        if (livestream.status !== 'live') {
            return {
                success: false,
                message: 'Livestream is not currently live'
            };
        }

        // Check permissions: Only admin or the livestream owner can end it
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const isOwner = livestream.hostId.toString() === userId.toString();

        if (!isAdmin && !isOwner) {
            return {
                success: false,
                message: 'You do not have permission to end this livestream. Only the livestream owner or admin can end it.',
                error: 'INSUFFICIENT_PERMISSIONS'
            };
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
                duration: livestream.endTime - livestream.startTime,
                endedBy: {
                    userId: userId,
                    role: userRole,
                    isOwner: isOwner
                }
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

        // Get real-time viewer count from LiveKit
        const currentViewers = await getRealTimeViewers(livestream.roomName);

        // Update peak and min viewers
        await updateViewerStats(livestream._id, currentViewers);

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
                currentViewers: currentViewers, // Real-time count
                peakViewers: livestream.peakViewers,
                minViewers: livestream.minViewers,
                status: livestream.status,
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

// Leave livestream (User)
exports.leaveLivestream = async (livestreamId, userId) => {
    try {
        // Find livestream
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) {
            throw new Error('Livestream not found');
        }

        if (livestream.status !== 'live') {
            throw new Error('Livestream is not currently live');
        }

        // Get real-time viewer count from LiveKit
        const currentViewers = await getRealTimeViewers(livestream.roomName);

        // Update peak and min viewers
        await updateViewerStats(livestream._id, currentViewers);

        return {
            success: true,
            message: 'Left livestream successfully',
            data: {
                livestreamId: livestream._id,
                currentViewers: currentViewers, // Real-time count
                peakViewers: livestream.peakViewers,
                minViewers: livestream.minViewers,
                leftAt: new Date()
            }
        };

    } catch (error) {
        console.error('Error leaving livestream:', error);
        return {
            success: false,
            message: `Failed to leave livestream: ${error.message}`,
            error: error.message
        };
    }
};


// Get live streams
exports.getLiveStreams = async () => {
    try {
        const livestreams = await Livestream.find({ status: 'live' })
            .select('_id hostId title description roomName startTime peakViewers minViewers')
            .sort({ startTime: -1 });

        // Add real-time viewer count to each livestream
        const streamsWithRealTime = await Promise.all(
            livestreams.map(async (livestream) => {
                const currentViewers = await getRealTimeViewers(livestream.roomName);

                // Update peak and min viewers
                await updateViewerStats(livestream._id, currentViewers);

                return {
                    ...livestream.toObject(),
                    currentViewers: currentViewers // Real-time count
                };
            })
        );

        return {
            success: true,
            message: 'Live streams retrieved successfully',
            data: {
                streams: streamsWithRealTime,
                count: streamsWithRealTime.length
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
        const token = generateAccessToken(roomName, 'Host', 'Host', true);

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

// Get all livestreams (both live and ended)
exports.getAllLive = async (page = 1, limit = 10) => {
    try {
        const skip = (page - 1) * limit;

        const livestreams = await Livestream.find()
            .select('_id hostId title description roomName status startTime endTime currentViewers')
            .sort({ startTime: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Livestream.countDocuments();

        return {
            success: true,
            message: 'All livestreams retrieved successfully',
            data: {
                livestreams: livestreams,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        };

    } catch (error) {
        console.error('Error getting all livestreams:', error);
        return {
            success: false,
            message: `Failed to get all livestreams: ${error.message}`,
            error: error.message
        };
    }
};

// Get specific livestream details
exports.getLive = async (livestreamId) => {
    try {
        // Validate ObjectId format
        if (!livestreamId || !livestreamId.match(/^[0-9a-fA-F]{24}$/)) {
            return {
                success: false,
                message: 'Invalid livestream ID format'
            };
        }

        const livestream = await Livestream.findById(livestreamId)
            .select('_id hostId title description roomName status startTime endTime currentViewers');

        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        return {
            success: true,
            message: 'Livestream details retrieved successfully',
            data: {
                livestream: livestream
            }
        };

    } catch (error) {
        console.error('Error getting livestream details:', error);
        return {
            success: false,
            message: `Failed to get livestream details: ${error.message}`,
            error: error.message
        };
    }
};

// Get currently live streams only
exports.getLiveNow = async () => {
    try {
        const livestreams = await Livestream.find({ status: 'live' })
            .select('_id hostId title description roomName startTime currentViewers')
            .sort({ startTime: -1 });

        return {
            success: true,
            message: 'Currently live streams retrieved successfully',
            data: {
                liveStreams: livestreams,
                count: livestreams.length,
                timestamp: new Date()
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