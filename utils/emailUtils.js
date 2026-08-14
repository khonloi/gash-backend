'use strict';

// In-memory OTP store.
// NOTE: This is only suitable for single-instance deployments.
// For multi-instance setups, replace with a Redis-backed store.
const otpStore = new Map();

// Rate limiting: track OTP request timestamps per email to prevent abuse.
// Allows a maximum of MAX_OTP_REQUESTS_PER_WINDOW requests per time window.
const otpRequestLog = new Map();
const MAX_OTP_REQUESTS_PER_WINDOW = 5;
const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_TTL_MS = 10 * 60 * 1000; // OTP expires after 10 minutes
const MAX_VERIFY_ATTEMPTS = 5; // Max failed verification attempts before lockout

// Track failed verification attempts per email
const verifyFailures = new Map();

/**
 * Generates a cryptographically random 6-digit OTP.
 * Uses crypto.randomInt to avoid Math.random() modulo bias.
 */
const generateOTP = () => {
  const { randomInt } = require('crypto');
  return randomInt(100000, 999999).toString();
};

/**
 * Checks whether the email has exceeded the rate limit for OTP requests.
 * @param {string} email
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
const checkOTPRateLimit = (email) => {
  const now = Date.now();
  const timestamps = (otpRequestLog.get(email) || []).filter(
    (ts) => now - ts < OTP_WINDOW_MS
  );

  if (timestamps.length >= MAX_OTP_REQUESTS_PER_WINDOW) {
    const oldestInWindow = Math.min(...timestamps);
    const retryAfterMs = OTP_WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  otpRequestLog.set(email, timestamps);
  return { allowed: true };
};

/**
 * Stores an OTP for the given email with an expiry timestamp.
 * Enforces rate limiting — returns false if the rate limit is exceeded.
 *
 * @param {string} email
 * @param {string} otp
 * @returns {{ stored: boolean, rateLimited?: boolean, retryAfterMs?: number }}
 */
const storeOTP = (email, otp) => {
  const rateCheck = checkOTPRateLimit(email);
  if (!rateCheck.allowed) {
    return { stored: false, rateLimited: true, retryAfterMs: rateCheck.retryAfterMs };
  }

  const expires = Date.now() + OTP_TTL_MS;
  otpStore.set(email, { otp, expires, attempts: 0 });
  // NOTE: The OTP is intentionally NOT logged here — OTP values must never appear in logs.
  return { stored: true };
};

/**
 * Verifies the provided OTP for a given email.
 * Returns false on expiry, wrong OTP, or after too many failed attempts (brute-force protection).
 *
 * @param {string} email
 * @param {string} otp
 * @returns {boolean}
 */
const verifyStoredOTP = (email, otp) => {
  const stored = otpStore.get(email);

  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email);
    verifyFailures.delete(email);
    return false;
  }

  // Brute-force protection: lock out after too many failed attempts
  const failures = verifyFailures.get(email) || 0;
  if (failures >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(email);
    verifyFailures.delete(email);
    return false;
  }

  if (stored.otp !== otp) {
    verifyFailures.set(email, failures + 1);
    return false;
  }

  // OTP is valid — clean up all state for this email
  otpStore.delete(email);
  verifyFailures.delete(email);
  return true;
};

module.exports = { generateOTP, storeOTP, verifyStoredOTP, checkOTPRateLimit };