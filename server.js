const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // <-- Add this
const authRoutes = require('./routes/authRoutes');
const accountsRoutes = require('./routes/accountRoutes');
const productsRoutes = require('./routes/productRoutes');
const categoriesRoutes = require('./routes/categoryRoutes');
const ordersRoutes = require('./routes/orderRoutes');
const orderDetailsRoutes = require('./routes/orderDetailRoutes');
const cartsRoutes = require('./routes/cartRoutes');
const favoritesRoutes = require('./routes/favoriteRoutes');
const importBillRoutes = require('./routes/importBillRoutes');
// const importBillDetailsRoutes = require('./routes/ImportBillDetails');
// const warehousesRoutes = require('./routes/Warehouses');
const productSpecRoutes = require('./routes/specRoutes');
const statisticsRoutes = require('./routes/statisticRoutes');
const productVarRoutes = require('./routes/variantRoutes');
require('dotenv').config();


const app = express();
const server = http.createServer(app); // <-- Create HTTP server
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Make io accessible in routes/controllers
app.set('io', io);

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] })); // Allow frontend
app.use(express.json());

// Log environment variables for debugging
console.log('EMAILJS_USER_ID:', process.env.EMAILJS_USER_ID ? 'Set' : 'Missing');

// Routes
app.use('/auth', authRoutes);
app.use('/accounts', accountsRoutes);
app.use('/products', productsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/orders', ordersRoutes);
app.use('/order-details', orderDetailsRoutes);
app.use('/carts', cartsRoutes);
app.use('/variants', productVarRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/imports', importBillRoutes);
// app.use('/importbilldetails', importBillDetailsRoutes);
// app.use('/warehouses', warehousesRoutes);
app.use('/specifications', productSpecRoutes);
app.use('/statistics', statisticsRoutes);

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB database gash');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { // <-- Use server.listen
  console.log(`Server running on port ${PORT}`);
});

// Optionally, handle socket.io connections
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});