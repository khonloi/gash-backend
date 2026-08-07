const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');

// LiveKit configuration
const LIVEKIT_CONFIG = {
    // LiveKit server URL (can use cloud or self-hosted)
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
        ttl: 7200, // 2 hours - Suitable for most use cases
        // Reasons for choosing 2 hours:
        // Good balance between security and performance
        // Most livestreams last 1-2 hours -> no refresh needed
        // Longer livestreams (>2h) -> only need to refresh once
        // Better security than 4 hours (token doesn't last too long)
        // Good performance (refresh not too frequent)
        canPublish: false, // Viewers cannot publish video (only host can)
        canSubscribe: true, // Viewers can subscribe to watch
        canPublishData: true // Allow sending data messages (for comments/reactions)
    }
};

// Validate required environment variables
const validateConfig = () => {
    const requiredEnvVars = ['LIVEKIT_SERVER_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.warn(`Warning: Missing LiveKit environment variables: ${missing.join(', ')}`);
        console.warn('   Using default/placeholder values. This will not work in production!');
    }
};

// Validate on module load
validateConfig();

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
    // Host: can publish video/audio, can subscribe
    // Viewers: can only subscribe (watch), cannot publish
    token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: isHost, // Only host can publish video/audio
        canSubscribe: LIVEKIT_CONFIG.tokenSettings.canSubscribe, // Both can subscribe/watch
        canPublishData: LIVEKIT_CONFIG.tokenSettings.canPublishData, // Both can send data (comments)
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