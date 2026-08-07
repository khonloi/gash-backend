// Load and validate environment variables first — before any other imports.
require('dotenv').config();
const env = require('./config/env');
env.validate();

const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = require('./app');
const { CORS_ORIGINS } = require('./app');
const chatSocket = require('./sockets/chat');
const productSocket = require('./sockets/productSocket');
const notificationSocket = require('./sockets/notificationSocket');
const orderSocket = require('./sockets/orderSocket');

// ===== LiveKit Service (SIMPLE) =====
const livestreamService = require('./services/livestreamService');
const vnpayExpiryService = require('./services/vnpayExpiryService');

// Tạo HTTP server với timeout cho upload nhiều file
const server = http.createServer(app);
server.timeout = 300000; // 5 phút (300 giây) cho upload nhiều file
server.keepAliveTimeout = 65000; // 65 giây
server.headersTimeout = 66000; // 66 giây

// Socket.IO — shares CORS origins with Express app
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

// Connect to MongoDB
mongoose.connect(env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    vnpayExpiryService.startExpiryChecker();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });


// Socket cha
chatSocket(io);
// Socket product
productSocket(io);
// 🔔 Socket notification
notificationSocket(io);
// 📦 Socket order
orderSocket(io);

// ===== Initialize LiveKit Service (SIMPLE) =====
console.log('🚀 LiveKit service ready');

// ===== Graceful Shutdown =====
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');
    try {
      io.close();
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    } catch (err) {
      console.error('Error during shutdown:', err.message);
    }
    process.exit(0);
  });
};


// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = env.PORT;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} [${env.NODE_ENV}]`);
  console.log(`🚀 LiveKit livestream: READY`);
});