// sockets/orderSocket.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Store connected users map (exported for potential use in controllers)
const connectedUsers = new Map();

const orderSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`📦 Order socket connected: ${socket.id}`);

    // Handle user connection with optional authentication
    socket.on('userConnected', (userId) => {
      if (!userId) return;
      connectedUsers.set(userId.toString(), socket.id);
      socket.join(`user_${userId.toString()}`);
      console.log(`✅ User ${userId} joined order room: user_${userId}`);
    });

    // Handle authenticated connection (with JWT token)
    socket.on('authenticate', (token) => {
      if (!token) return;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        const userId = decoded.id || decoded._id;
        
        connectedUsers.set(userId.toString(), socket.id);
        socket.join(`user_${userId.toString()}`);
        console.log(`✅ Authenticated user ${userId} joined order room`);

        // Join admin room if user is admin or manager
        if (decoded.role === 'admin' || decoded.role === 'manager') {
          socket.join('order_admins');
          console.log(`✅ Admin/Manager ${userId} joined order_admins room`);
        }
      } catch (err) {
        console.error('❌ Authentication error:', err.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`❌ User ${userId} disconnected from orders`);
          break;
        }
      }
      console.log(`❌ Order socket disconnected: ${socket.id}`);
    });
  });
};

// Export connectedUsers for use in controllers (if needed)
orderSocket.connectedUsers = connectedUsers;

module.exports = orderSocket;