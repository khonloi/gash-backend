const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  // Template name
  name: { type: String },

  // Main notification content
  title: { type: String, required: true },
  message: { type: String, required: true },

  // Recipient (if null, this is a global notification)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Accounts",
    default: null,
  },

  // Notification type
  type: {
    type: String,
    enum: ["system", "order", "promotion", "preference", "livestream"],
    default: "system",
  },

  // Livestream ID (for livestream notifications)
  livestreamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Livestream",
    default: null,
  },

  // Read status
  isRead: { type: Boolean, default: false },

  // Template flag
  isTemplate: { type: Boolean, default: false },

  // Creation timestamp
  createdAt: { type: Date, default: Date.now },

  // Notification preferences (email / web)
  preferences: {
    email: { type: Boolean, default: true },
    web: { type: Boolean, default: true },
  },
});

// ===== Indexes =====
// User inbox: fetch all unread notifications for a user (most common query)
NotificationSchema.index({ userId: 1, isRead: 1 });

// Sort newest-first
NotificationSchema.index({ createdAt: -1 });

// Filter by type (e.g., only order notifications)
NotificationSchema.index({ type: 1 });

// TTL index: MongoDB automatically deletes notifications older than 90 days.
// This keeps the collection from growing indefinitely without requiring a cron job.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('Notification', NotificationSchema);

