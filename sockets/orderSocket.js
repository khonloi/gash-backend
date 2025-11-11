// sockets/orderSocket.js (New file)
const jwt = require('jsonwebtoken');
require('dotenv').config();

const orderSocket = (io) => {
  // Socket.IO middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected for orders: ${socket.user.id}`);

    // Join user-specific room
    socket.join(`user_${socket.user.id}`);

    // Join admin room if user is admin or manager
    if (socket.user.role === 'admin' || socket.user.role === 'manager') {
      socket.join('order_admins');
    }

    socket.on('disconnect', () => {
      console.log(`User disconnected from orders: ${socket.user.id}`);
    });
  });
};

module.exports = orderSocket;