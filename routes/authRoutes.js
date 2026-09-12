const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimitMiddleware');
const { 
  registerSchema, 
  loginSchema, 
  emailSchema, 
  verifyOtpSchema, 
  resetPasswordSchema, 
  googleLoginSchema,
  refreshTokenSchema
} = require('../validations/authValidation');

// Request OTP for registration
router.post('/register/request-otp', otpLimiter, validateRequest(emailSchema), authController.requestRegisterOtp);

// Verify OTP for registration
router.post('/register/verify-otp', authLimiter, authController.verifyRegisterOtp);

// Register a new user (requires prior OTP verification)
router.post('/register', authLimiter, validateRequest(registerSchema), authController.register);

// Login route
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);

// Refresh Access Token
router.post('/refresh-token', authLimiter, validateRequest(refreshTokenSchema), authController.refreshAccessToken);

// Google Login route
router.post('/google-login', authLimiter, validateRequest(googleLoginSchema), authController.googleLogin);

// Request OTP for forgot password
router.post('/forgot-password/request-otp', otpLimiter, validateRequest(emailSchema), authController.requestForgotPasswordOtp);

// Verify OTP for forgot password
router.post('/forgot-password/verify-otp', authLimiter, validateRequest(verifyOtpSchema), authController.verifyForgotPasswordOtp);

// Reset password
router.post('/forgot-password/reset', authLimiter, validateRequest(resetPasswordSchema), authController.resetPassword);

// Check authentication status
router.get('/check-status', authenticateJWT, authController.checkStatus);

module.exports = router;