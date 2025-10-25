const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');

// LiveKit configuration
const LIVEKIT_CONFIG = {
    // LiveKit server URL (có thể dùng cloud hoặc self-hosted)
    serverUrl: process.env.LIVEKIT_SERVER_URL || 'wss://your-livekit-server.com',

    // API credentials
    apiKey: process.env.LIVEKIT_API_KEY || 'your-api-key',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'your-api-secret',

    // Room settings
    roomSettings: {
        maxParticipants: 100,
        emptyTimeout: 300, // 5 minutes
        enableRecording: false,
        enableTranscription: false
    },

    // Token settings
    tokenSettings: {
        ttl: 3600, // 1 hour
        canPublish: true,
        canSubscribe: true,
        canPublishData: true
    }
};

// Initialize LiveKit client
const roomService = new RoomServiceClient(
    LIVEKIT_CONFIG.serverUrl,
    LIVEKIT_CONFIG.apiKey,
    LIVEKIT_CONFIG.apiSecret
);

// Generate access token for user
const generateAccessToken = (roomName, participantName, participantIdentity, isHost = false) => {
    const token = new AccessToken(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret, {
        identity: participantIdentity,
        name: participantName,
        ttl: LIVEKIT_CONFIG.tokenSettings.ttl
    });

    // Grant permissions
    token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: isHost ? true : LIVEKIT_CONFIG.tokenSettings.canPublish,
        canSubscribe: LIVEKIT_CONFIG.tokenSettings.canSubscribe,
        canPublishData: LIVEKIT_CONFIG.tokenSettings.canPublishData,
        hidden: false,
        recorder: false
    });

    return token.toJwt();
};

// Create room
const createRoom = async (roomName, options = {}) => {
    try {
        const roomOptions = {
            name: roomName,
            maxParticipants: options.maxParticipants || LIVEKIT_CONFIG.roomSettings.maxParticipants,
            emptyTimeout: options.emptyTimeout || LIVEKIT_CONFIG.roomSettings.emptyTimeout,
            enableRecording: options.enableRecording || LIVEKIT_CONFIG.roomSettings.enableRecording,
            enableTranscription: options.enableTranscription || LIVEKIT_CONFIG.roomSettings.enableTranscription
        };

        const room = await roomService.createRoom(roomOptions);
        return {
            success: true,
            room: room,
            message: 'Room created successfully'
        };
    } catch (error) {
        console.error('Error creating room:', error);
        return {
            success: false,
            error: error.message,
            message: 'Failed to create room'
        };
    }
};

// Delete room
const deleteRoom = async (roomName) => {
    try {
        await roomService.deleteRoom(roomName);
        return {
            success: true,
            message: 'Room deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting room:', error);
        return {
            success: false,
            error: error.message,
            message: 'Failed to delete room'
        };
    }
};


module.exports = {
    LIVEKIT_CONFIG,
    roomService,
    generateAccessToken,
    createRoom,
    deleteRoom
};