const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Register a new user
router.post('/register', authController.register);

// Verify OTP for registration
router.post('/register/verify-otp', authController.verifyRegisterOtp);

// Request OTP for forgot password
router.post('/forgot-password/request-otp', authController.requestForgotPasswordOtp);

// Verify OTP for forgot password
router.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOtp);

// Reset password
router.post('/forgot-password/reset', authController.resetPassword);

// Login route
router.post('/login', authController.login);

// Google Login route
router.post('/google-login', authController.googleLogin);

// Request OTP for registration
router.post('/register/request-otp', authController.requestRegisterOtp);

// Check authentication status
router.get('/check-status', authenticateJWT, authController.checkStatus);

module.exports = router;