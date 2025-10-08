const jwt = require('jsonwebtoken');
const Accounts = require('../models/Accounts');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const account = await Accounts.findById(decoded.id).select('-password');
    if (!account) {
      return res.status(401).json({ message: 'Invalid token: Account not found' });
    }
    if (account.acc_status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive or suspended' });
    }
    req.user = { id: account._id.toString(), username: account.username, role: account.role }; // Convert ObjectId to string
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

const authorizeRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: Not authorized' });
  }
  next();
};

// Middleware tùy chỉnh để xử lý authentication optional
const optionalAuth = (req, res, next) => {
  // Nếu có token thì authenticate, nếu không thì bỏ qua
  if (req.headers.authorization) {
    return authenticateJWT(req, res, next);
  }
  // Không có token thì tiếp tục mà không có req.user
  next();
};

module.exports = { authenticateJWT, authorizeRole, JWT_SECRET, optionalAuth };