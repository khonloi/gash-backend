const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  // 🔹 Dùng cho template
  name: { type: String },

  // 🔹 Thông tin chính
  title: { type: String, required: true },
  message: { type: String, required: true },

  // 🔹 Người nhận (nếu null thì là thông báo chung)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Accounts",
    default: null,
  },

  // 🔹 Loại thông báo
  type: {
    type: String,
    enum: ["system", "order", "promotion", "preference", "livestream"],
    default: "system",
  },

  // 🔹 Livestream ID (for livestream notifications)
  livestreamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Livestream",
    default: null,
  },

  // 🔹 Trạng thái đọc
  isRead: { type: Boolean, default: false },

  // 🔹 Là template hay không
  isTemplate: { type: Boolean, default: false },

  // 🔹 Ngày tạo
  createdAt: { type: Date, default: Date.now },

  // ⚙️ Tuỳ chọn thông báo (email / web)
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

