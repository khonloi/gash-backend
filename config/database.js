'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGO_URI from environment variables.
 * - Logs connection events for observability.
 * - Exits the process on initial connection failure.
 * - Automatically re-attempts on connection loss (Mongoose built-in behavior).
 *
 * Usage in server.js:
 *   const { connectDatabase } = require('./config/database');
 *   await connectDatabase();
 */
async function connectDatabase() {
  const MONGO_URI = process.env.MONGO_URI;

  // Log connection lifecycle events
  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected — attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });

  try {
    await mongoose.connect(MONGO_URI, {
      // Recommended settings for production stability
      serverSelectionTimeoutMS: 5000,  // Fail fast if no server found within 5s
      socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
    });
  } catch (err) {
    console.error('MongoDB initial connection failed:', err.message);
    process.exit(1);
  }
}

/**
 * Gracefully closes the MongoDB connection.
 * Called during server shutdown.
 */
async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed gracefully');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }
}

module.exports = { connectDatabase, disconnectDatabase };
