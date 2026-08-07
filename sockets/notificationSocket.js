// sockets/notificationSocket.js
const mongoose = require('mongoose');

// Track userId -> socketId for connected notification clients
const connectedUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    /**
     * Fired by the frontend after login to join the user's notification room.
     * The room name matches the format used by orderNotificationHelper and orderSocket.
     */
    socket.on('userConnected', (userId) => {
      if (!userId || !mongoose.isValidObjectId(userId.toString())) {
        if (process.env.DEBUG === 'true') {
          console.warn('⚠️ userConnected: invalid or missing userId');
        }
        return;
      }

      const userIdStr = userId.toString();
      connectedUsers.set(userIdStr, socket.id);

      // Join both room formats for compatibility with all notification emitters
      socket.join(userIdStr);
      socket.join(`user_${userIdStr}`);

      if (process.env.DEBUG === 'true') {
        console.log(`🔔 User ${userIdStr} joined notification rooms`);
      }
    });

    /**
     * Legacy joinRoom event — kept for backward compatibility.
     */
    socket.on('joinRoom', (userId) => {
      if (!userId || !mongoose.isValidObjectId(userId.toString())) return;
      const userIdStr = userId.toString();
      socket.join(userIdStr);
      socket.join(`user_${userIdStr}`);
    });

    socket.on('disconnect', () => {
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          if (process.env.DEBUG === 'true') {
            console.log(`🔔 User ${userId} disconnected from notifications`);
          }
          break;
        }
      }
    });
  });
};

// Export Map so controllers can check if a user is online (if needed)
module.exports.connectedUsers = connectedUsers;
