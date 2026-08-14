// Load and validate environment variables first — before any other imports.
require('dotenv').config();
const env = require('./config/env');
env.validate();

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const { CORS_ORIGINS } = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const vnpayExpiryService = require('./services/vnpayExpiryService');

const chatSocket         = require('./sockets/chat');
const productSocket      = require('./sockets/productSocket');
const notificationSocket = require('./sockets/notificationSocket');
const orderSocket        = require('./sockets/orderSocket');

// ===== HTTP Server =====
// Longer timeouts for multi-file upload support
const server = http.createServer(app);
server.timeout          = 300_000; // 5 minutes for large uploads
server.keepAliveTimeout = 65_000;  // > load balancer timeout (60s)
server.headersTimeout   = 66_000;  // slightly above keepAliveTimeout

// ===== Socket.IO =====
// Shares CORS origin list with Express app (single source of truth in app.js)
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
app.set('io', io);

// ===== Socket Handlers =====
chatSocket(io);
productSocket(io);
notificationSocket(io);
orderSocket(io);

// ===== Database =====
// connectDatabase() registers Mongoose connection event listeners and exits
// on initial failure. VNPay expiry checker starts after connection is established.
connectDatabase().then(() => {
  vnpayExpiryService.startExpiryChecker();
});

// ===== Graceful Shutdown =====
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');
    io.close();
    await disconnectDatabase();
    process.exit(0);
  });

  // Force-kill if graceful shutdown takes too long (e.g., hung connections)
  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref(); // .unref() prevents the timer from keeping the process alive
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ===== Start Server =====
const PORT = env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${env.NODE_ENV}]`);
});