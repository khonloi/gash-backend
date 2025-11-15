const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const chatSocket = require('./sockets/chat');
const productSocket = require('./sockets/productSocket');
const notificationSocket = require('./sockets/notificationSocket');
const orderSocket = require('./sockets/orderSocket');

// ===== LiveKit Service (SIMPLE) =====
const livestreamService = require('./services/livestreamService');

// Tạo HTTP server với timeout cho upload nhiều file
const server = http.createServer(app);
server.timeout = 300000; // 5 phút (300 giây) cho upload nhiều file
server.keepAliveTimeout = 65000; // 65 giây
server.headersTimeout = 66000; // 66 giây

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://gash-pi.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
app.set('io', io);

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

// Socket chat
chatSocket(io);
// Socket product
productSocket(io);
// 🔔 Socket notification
notificationSocket(io);
// 📦 Socket order
orderSocket(io);

// ===== Initialize LiveKit Service (SIMPLE) =====
console.log('🚀 LiveKit service ready');

// ===== Graceful Shutdown (SIMPLE) =====
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
};

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`🚀 LiveKit livestream: READY`);
});