let ioInstance = null;

// Track active livestream rooms and their viewer counts
const activeLivestreamRooms = new Map(); // liveId -> { socketCount: number, lastViewerCount: number, intervalId: number, lastChangeTime: number, stableCount: number }

// Adaptive viewer count intervals (milliseconds)
const VIEWER_COUNT_INTERVALS = {
  ACTIVE: 5000,      // 5s when count is changing frequently
  STABLE: 10000,     // 10s when count is stable
  VERY_STABLE: 15000 // 15s when count hasn't changed for a while
};

// Time thresholds (milliseconds)
const STABLE_THRESHOLD = 30000;    // 30s without change = stable
const VERY_STABLE_THRESHOLD = 60000; // 60s without change = very stable

const initializeProductSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    // Only log in debug mode
    if (process.env.DEBUG === 'true') {
      console.log("New client connected:", socket.id);
    }

    // Join product room for general product updates
    socket.on("joinProductRoom", () => {
      socket.join("productRoom");
      if (process.env.DEBUG === 'true') {
        console.log("Client joined productRoom:", socket.id);
      }
    });

    // Join variant room for product variant updates
    socket.on("joinVariantRoom", () => {
      socket.join("variantRoom");
      if (process.env.DEBUG === 'true') {
        console.log("Client joined variantRoom:", socket.id);
      }
    });

    // Join livestream product room
    socket.on("joinLiveProductRoom", (liveId) => {
      const room = `live_${liveId}`;
      socket.join(room);
      if (process.env.DEBUG === 'true') {
        console.log(`Client joined ${room}:`, socket.id);
      }
    });

    // Join livestream room for comments and viewer count updates
    socket.on("joinLivestreamRoom", async (liveId) => {
      if (!liveId) return;

      const room = `live_${liveId}`;
      socket.join(room);

      // Track socket count for this livestream
      const roomData = activeLivestreamRooms.get(liveId) || {
        socketCount: 0,
        lastViewerCount: 0,
        intervalId: null,
        lastChangeTime: Date.now(),
        stableCount: 0,
        currentInterval: VIEWER_COUNT_INTERVALS.ACTIVE
      };
      roomData.socketCount += 1;
      activeLivestreamRooms.set(liveId, roomData);

      // Start broadcasting viewer count if first socket joins
      if (roomData.socketCount === 1) {
        startViewerCountBroadcast(io, liveId);
      }

      // Send initial viewer count (optimized: only select needed fields)
      try {
        const { getRealTimeViewers } = require('../services/livestreamService');
        const Livestream = require('../models/Livestream');
        const livestream = await Livestream.findOne({ _id: liveId, status: 'live' }).select('_id roomName status').lean();

        if (livestream) {
          const viewerCount = await getRealTimeViewers(livestream.roomName, false);
          socket.emit('viewer:count', { liveId, count: viewerCount });
        }
      } catch (error) {
        // Silently handle error
      }

      if (process.env.DEBUG === 'true') {
        console.log(`Client ${socket.id} joined livestream room ${room}`);
      }
    });

    // Leave livestream room
    socket.on("leaveLivestreamRoom", (liveId) => {
      if (!liveId) return;

      const room = `live_${liveId}`;
      socket.leave(room);

      // Decrease socket count
      const roomData = activeLivestreamRooms.get(liveId);
      if (roomData) {
        roomData.socketCount = Math.max(0, roomData.socketCount - 1);

        // Stop broadcasting if no sockets left
        if (roomData.socketCount === 0) {
          if (roomData.intervalId) {
            clearInterval(roomData.intervalId);
            roomData.intervalId = null;
          }
          activeLivestreamRooms.delete(liveId);
        } else {
          activeLivestreamRooms.set(liveId, roomData);
        }
      }

      if (process.env.DEBUG === 'true') {
        console.log(`Client ${socket.id} left livestream room ${room}`);
      }
    });

    socket.on("disconnect", () => {
      // Clean up when socket disconnects - will be handled by leaveLivestreamRoom
      if (process.env.DEBUG === 'true') {
        console.log("Client disconnected:", socket.id);
      }
    });
  });
};

// Broadcast viewer count periodically for active livestreams with adaptive intervals
const startViewerCountBroadcast = (io, liveId) => {
  const roomData = activeLivestreamRooms.get(liveId);
  if (!roomData || roomData.intervalId) return; // Already broadcasting

  const broadcastWithAdaptiveInterval = async () => {
    try {
      const { getRealTimeViewers } = require('../services/livestreamService');
      const Livestream = require('../models/Livestream');

      const livestream = await Livestream.findOne({ _id: liveId, status: 'live' }).select('_id roomName status').lean();
      if (!livestream) {
        // Livestream ended, stop broadcasting
        if (roomData.intervalId) {
          clearInterval(roomData.intervalId);
          roomData.intervalId = null;
        }
        activeLivestreamRooms.delete(liveId);
        return;
      }

      const viewerCount = await getRealTimeViewers(livestream.roomName);
      const now = Date.now();
      const timeSinceLastChange = now - roomData.lastChangeTime;

      // Only broadcast if count changed (to reduce unnecessary network traffic)
      if (viewerCount !== roomData.lastViewerCount) {
        roomData.lastViewerCount = viewerCount;
        roomData.lastChangeTime = now;
        roomData.stableCount = 0;

        // Reset to active interval when count changes
        roomData.currentInterval = VIEWER_COUNT_INTERVALS.ACTIVE;

        // Restart with new interval if needed
        if (roomData.intervalId) {
          clearInterval(roomData.intervalId);
        }

        io.to(`live_${liveId}`).emit('viewer:count', {
          liveId,
          count: viewerCount
        });

        // Restart interval with active timing
        roomData.intervalId = setInterval(broadcastWithAdaptiveInterval, roomData.currentInterval);
        activeLivestreamRooms.set(liveId, roomData);
      } else {
        // Count hasn't changed - adapt interval based on stability
        roomData.stableCount += 1;

        let newInterval = roomData.currentInterval;
        if (timeSinceLastChange >= VERY_STABLE_THRESHOLD && roomData.currentInterval !== VIEWER_COUNT_INTERVALS.VERY_STABLE) {
          newInterval = VIEWER_COUNT_INTERVALS.VERY_STABLE;
        } else if (timeSinceLastChange >= STABLE_THRESHOLD && roomData.currentInterval === VIEWER_COUNT_INTERVALS.ACTIVE) {
          newInterval = VIEWER_COUNT_INTERVALS.STABLE;
        }

        // Only restart interval if it changed
        if (newInterval !== roomData.currentInterval) {
          roomData.currentInterval = newInterval;
          if (roomData.intervalId) {
            clearInterval(roomData.intervalId);
          }
          roomData.intervalId = setInterval(broadcastWithAdaptiveInterval, newInterval);
          activeLivestreamRooms.set(liveId, roomData);
        }
      }
    } catch (error) {
      // Silently handle error, but don't stop broadcasting
      if (process.env.DEBUG === 'true') {
        console.error(`Error in viewer count broadcast for ${liveId}:`, error.message);
      }
    }
  };

  // Start first broadcast immediately, then use interval
  broadcastWithAdaptiveInterval();
  roomData.intervalId = setInterval(broadcastWithAdaptiveInterval, roomData.currentInterval);
  activeLivestreamRooms.set(liveId, roomData);
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized!');
  }
  return ioInstance;
};

module.exports = initializeProductSocket;
module.exports.getIO = getIO;
