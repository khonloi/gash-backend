const rateLimit = require('express-rate-limit');

// Rate limiter for general auth endpoints (e.g., register, login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for OTP requests (stricter to prevent SMS/Email spam)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 OTP requests per hour
  message: { message: 'Too many OTP requests from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  otpLimiter
};
