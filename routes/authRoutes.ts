import express from "express";
import authController from "../controllers/authController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimitMiddleware.js";
import {
  registerSchema,
  loginSchema,
  requestOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  googleLoginSchema,
  refreshTokenSchema,
} from "../validations/authValidation.js";

const router = express.Router();

// Request OTP
router.post(
  "/request-otp",
  otpLimiter,
  validateRequest(requestOtpSchema),
  authController.requestOtp,
);

// Verify OTP
router.post(
  "/verify-otp",
  authLimiter,
  validateRequest(verifyOtpSchema),
  authController.verifyOtp,
);

// Register a new user (requires prior OTP verification)
router.post(
  "/register",
  authLimiter,
  validateRequest(registerSchema),
  authController.register,
);

// Login route
router.post(
  "/login",
  authLimiter,
  validateRequest(loginSchema),
  authController.login,
);

// Refresh Access Token
router.post(
  "/refresh-token",
  authLimiter,
  validateRequest(refreshTokenSchema),
  authController.refreshAccessToken,
);

// Google Login route
router.post(
  "/google-login",
  authLimiter,
  validateRequest(googleLoginSchema),
  authController.googleLogin,
);

// Reset password
router.post(
  "/forgot-password/reset",
  authLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword,
);

// Check authentication status
router.get("/check-status", authenticateJWT, authController.checkStatus);

export default router;
module.exports = router;
