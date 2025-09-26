const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// ===== Middleware =====
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Public folder (CSS, JS, static files)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Cho phép truy cập ảnh trong thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== Routes =====
const authRoutes = require('./routes/authRoutes');
const accountsRoutes = require('./routes/accountRoutes');
const productsRoutes = require('./routes/productRoutes');
const categoriesRoutes = require('./routes/categoryRoutes');
const ordersRoutes = require('./routes/orderRoutes');
const orderDetailsRoutes = require('./routes/orderDetailRoutes');
const cartsRoutes = require('./routes/cartRoutes');
const favoritesRoutes = require('./routes/favoriteRoutes');
const importBillRoutes = require('./routes/importBillRoutes');
const productSpecRoutes = require('./routes/specRoutes');
const statisticsRoutes = require('./routes/statisticRoutes');
const productVarRoutes = require('./routes/variantRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite
    'http://localhost:3000', // CRA hoặc client khác
    'http://localhost:3001'  // nếu chạy song song
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// app.use(morgan('dev'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/specifications', productSpecRoutes);
app.use('/statistics', statisticsRoutes);
app.use('/upload', uploadRoutes);

// ===== 404 handler =====
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

module.exports = app;