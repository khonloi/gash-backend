const jwt = require('jsonwebtoken');
const Accounts = require('../models/Accounts');

// Fail fast if JWT_SECRET is not set — a hardcoded fallback is a critical security risk.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

/**
 * Core JWT authentication logic — shared by all auth middlewares.
 * Verifies the Bearer token, loads the account, checks active status.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {string} [contextLabel] - Label for error messages (e.g. 'LiveKit', 'Livestream')
 */
const _verifyJWT = async (req, res, next, contextLabel = '') => {
  const prefix = contextLabel ? `${contextLabel} ` : '';
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: `${prefix}Authentication token required` });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const account = await Accounts.findById(decoded.id).select('-password');
    if (!account) {
      return res.status(401).json({ message: `${prefix}Invalid token: Account not found` });
    }
    if (account.accountStatus !== 'active') {
      return res.status(403).json({ message: `Account is inactive or suspended` });
    }
    req.user = {
      id: account._id.toString(),
      username: account.username,
      role: account.role,
    };
    next();
  } catch (error) {
    res.status(401).json({ message: `${prefix}Invalid or expired token`, error: error.message });
  }
};

/**
 * Standard JWT authentication middleware.
 */
const authenticateJWT = (req, res, next) => _verifyJWT(req, res, next);

/**
 * Optional authentication — attaches req.user if a valid token is present,
 * but does NOT reject the request if no token is provided.
 */
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return _verifyJWT(req, res, next);
  }
  next();
};

/**
 * Authorization middleware — restricts access to specific roles.
 * Must be used AFTER authenticateJWT.
 * @param {string[]} roles - Array of allowed roles (e.g. ['admin', 'manager'])
 */
const authorizeRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: Not authorized' });
  }
  next();
};

/**
 * LiveKit-specific authentication. Same as authenticateJWT but sets req.livekit = true.
 * Kept separate to allow LiveKit-specific logic in controllers if needed.
 */
const authenticateLiveKit = async (req, res, next) => {
  await _verifyJWT(req, res, (err) => {
    if (!err) req.livekit = true;
    next(err);
  }, 'LiveKit');
};

/**
 * Livestream-specific authentication. Same as authenticateJWT but sets req.livestream = true.
 */
const authenticateLivestream = async (req, res, next) => {
  await _verifyJWT(req, res, (err) => {
    if (!err) req.livestream = true;
    next(err);
  }, 'Livestream');
};

/**
 * Performance monitoring middleware — logs method, path, status code, and duration.
 * Only active in development or when DEBUG=true.
 */
const monitorPerformance = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development' && process.env.DEBUG !== 'true') {
    return next();
  }
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📊 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
};

module.exports = {
  JWT_SECRET, // Still exported for services that directly sign tokens (authService, passkeyService)
  authenticateJWT,
  authorizeRole,
  optionalAuth,
  authenticateLiveKit,
  authenticateLivestream,
  monitorPerformance,
};