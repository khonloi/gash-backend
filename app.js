const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// ===== CORS =====
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://gash-pi.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// ===== Middleware =====
// Only log in development or when DEBUG=true (reduce log spam in production)
if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
  app.use(morgan('dev'));
} else {
  // Only log errors in production
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}
// Tăng body size limit cho upload nhiều file
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== Routes =====
const authRoutes = require('./routes/authRoutes');
const accountsRoutes = require('./routes/accountRoutes');
const categoriesRoutes = require('./routes/categoryRoutes');
const ordersRoutes = require('./routes/orderRoutes');
const orderDetailsRoutes = require('./routes/orderDetailRoutes');
const favoritesRoutes = require('./routes/favoriteRoutes');
const productSpecRoutes = require('./routes/specificationRoutes');
const statisticsRoutes = require('./routes/statisticRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const billRoutes = require('./routes/billRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');

// ===== Mount routes =====
app.use('/auth', authRoutes);
app.use('/accounts', accountsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/orders', ordersRoutes);
app.use('/order-details', orderDetailsRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/specifications', productSpecRoutes);
app.use('/statistics', statisticsRoutes);
app.use('/upload', uploadRoutes);
app.use('/vouchers', voucherRoutes);
app.use('/conversations', conversationRoutes);
app.use('/conversations', messageRoutes);
app.use('/bills', billRoutes);
app.use('/messages', messageRoutes);
app.use('/feedback', feedbackRoutes);

// ===== New Product and Variant Routes =====
const newProductRoutes = require('./routes/newProductRoutes');
const newProductVariantRoutes = require('./routes/newProductVariantRoutes');
app.use('/new-products', newProductRoutes);
app.use('/new-variants', newProductVariantRoutes);

// ===== New Stat Routes =====
const newStatisticsRoutes = require('./routes/statRoutes');
app.use('/new-statistics', newStatisticsRoutes);

// ===== New Cart Routes =====
const newCartRoutes = require('./routes/newCartRoutes');
app.use('/new-carts', newCartRoutes);

// ===== Notification Routes =====
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/notifications', notificationRoutes);

// ===== Livestream Routes =====
const livestreamRoutes = require('./routes/livestreamRoutes');
const livestreamProductRoutes = require('./routes/livestreamProductRoutes');
const livestreamCommentRoutes = require('./routes/livestreamCommentRoutes');
const livestreamReactionRoutes = require('./routes/livestreamReactionRoutes');
app.use('/livestream', livestreamRoutes);
app.use('/livestream-products', livestreamProductRoutes);
app.use('/livestream-comments', livestreamCommentRoutes);
app.use('/livestream-reactions', livestreamReactionRoutes);

// ===== Passkey Routes =====
const passkeyRoutes = require('./routes/passkeyRoutes');
app.use('/passkeys', passkeyRoutes);

// ===== 404 handler =====
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.message);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message });
});

module.exports = app;
