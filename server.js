const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const chatSocket = require('./sockets/chat');
const productSocket = require('./sockets/productSocket');

// Tạo HTTP server
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001'
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));