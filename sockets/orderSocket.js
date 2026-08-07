// sockets/orderSocket.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Store connected users map
const connectedUsers = new Map();

// Rate limiting: max events per window per socket
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_EVENTS = 30;
const rateLimitMap = new Map();

function checkRateLimit(socketId) {
  const now = Date.now();
  const entry = rateLimitMap.get(socketId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count += 1;
  }
  rateLimitMap.set(socketId, entry);
  return entry.count <= RATE_LIMIT_MAX_EVENTS;
}

const orderSocket = (io) => {
  io.on('connection', (socket) => {
    if (process.env.DEBUG === 'true') {
      console.log(`Order socket connected: ${socket.id}`);
    }

    /**
     * userConnected — lightweight room join for users that don't have a JWT
     * (e.g., guest checkout). Validates the userId before joining.
     */
    socket.on('userConnected', (userId) => {
      if (!checkRateLimit(socket.id)) return;
      if (!userId || !mongoose.isValidObjectId(userId.toString())) return;

      const userIdStr = userId.toString();
      connectedUsers.set(userIdStr, socket.id);
      socket.join(`user_${userIdStr}`);

      if (process.env.DEBUG === 'true') {
        console.log(`User ${userIdStr} joined order room`);
      }
    });

    /**
     * authenticate — JWT-based auth. Sets socket.user and joins user/admin rooms.
     * Used by logged-in users and admin dashboard.
     */
    socket.on('authenticate', (token) => {
      if (!checkRateLimit(socket.id)) return;
      if (!token || typeof token !== 'string') return;

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;

        const userId = (decoded.id || decoded._id || '').toString();
        if (!userId || !mongoose.isValidObjectId(userId)) return;

        connectedUsers.set(userId, socket.id);
        socket.join(`user_${userId}`);

        // Join admin room if user has an elevated role
        if (decoded.role === 'admin' || decoded.role === 'manager') {
          socket.join('order_admins');
          if (process.env.DEBUG === 'true') {
            console.log(`Admin/Manager ${userId} joined order_admins room`);
          }
        }

        if (process.env.DEBUG === 'true') {
          console.log(`Authenticated user ${userId} joined order room`);
        }
      } catch (err) {
        // Invalid token — do not join any authenticated rooms
        if (process.env.DEBUG === 'true') {
          console.error('Order socket auth failed:', err.message);
        }
      }
    });

    socket.on('disconnect', () => {
      rateLimitMap.delete(socket.id);
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          if (process.env.DEBUG === 'true') {
            console.log(`User ${userId} disconnected from orders`);
          }
          break;
        }
      }
    });
  });
};

// Export connectedUsers for use in controllers (if needed)
orderSocket.connectedUsers = connectedUsers;

module.exports = orderSocket;