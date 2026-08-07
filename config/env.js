'use strict';

/**
 * Centralized environment variable validation.
 *
 * Called once at process startup (from server.js). Validates that all
 * required variables are set and exports a typed, validated config object
 * so the rest of the codebase reads from here rather than process.env directly.
 *
 * Usage:
 *   const env = require('./config/env');
 *   env.MONGO_URI  // string, guaranteed to be set
 */

const REQUIRED = [
  'JWT_SECRET',
  'MONGO_URI',
  'CLOUD_NAME',
  'CLOUD_API_KEY',
  'CLOUD_API_SECRET',
  'GOOGLE_CLIENT_ID',
  'VNP_TMN_CODE',
  'VNP_HASH_SECRET',
  'LIVEKIT_SERVER_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('\n❌ FATAL: Missing required environment variables:');
    missing.forEach((key) => console.error(`   • ${key}`));
    console.error('\nCopy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }
}

module.exports = {
  validate: validateEnv,

  // Server
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,

  // Database
  MONGO_URI: process.env.MONGO_URI,

  // Cloudinary
  CLOUD_NAME: process.env.CLOUD_NAME,
  CLOUD_API_KEY: process.env.CLOUD_API_KEY,
  CLOUD_API_SECRET: process.env.CLOUD_API_SECRET,

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  // WebAuthn
  RP_NAME: process.env.RP_NAME || 'GASH',
  RP_ID: process.env.RP_ID || 'localhost',

  // VNPay — merchant secrets from env, non-sensitive defaults from config/default.json
  VNP_TMN_CODE: process.env.VNP_TMN_CODE,
  VNP_HASH_SECRET: process.env.VNP_HASH_SECRET,
  VNP_RETURN_URL: process.env.VNP_RETURN_URL || 'http://localhost:5173/vnpay-return',
  VNP_IPN_URL: process.env.VNP_IPN_URL || 'http://localhost:5000/orders/vnpay-ipn',

  // LiveKit
  LIVEKIT_SERVER_URL: process.env.LIVEKIT_SERVER_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,

  // Debug flags
  DEBUG: process.env.DEBUG === 'true',
};
