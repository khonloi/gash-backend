const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const { connectedUsers } = require("../sockets/notificationSocket");
const User = require("../models/Accounts");

/** ====================== ADMIN ====================== */
exports.createNotification = async (req, res) => {
  try {
    console.log("📩 Body nhận được từ FE:", req.body);
    const notifications = await notificationService.createNotificationService(req.body);

    /** 🔔 Realtime emit qua Socket.IO */
    const io = req.app.get("io");

    if (io && notifications?.length) {
      for (const n of notifications) {
        if (n.recipientType === "all") {
          // Gửi cho tất cả user
          io.emit("newNotification", n);
          console.log("📢 Sent to ALL users");
        } 
        else if (n.recipientType === "specific" && n.userId) {
          // ✅ Gửi riêng cho user cụ thể (dùng username hoặc _id đều được)
          let targetId = n.userId;

          // Nếu không phải ObjectId → nghĩa là username
          if (!mongoose.isValidObjectId(targetId)) {
            const foundUser = await User.findOne({ username: n.userId });
            if (foundUser) targetId = foundUser._id.toString();
            else console.log("⚠️ Không tìm thấy user:", n.userId);
          }

          // ✅ Emit theo room thay vì socketId (fix realtime)
          io.to(targetId.toString()).emit("newNotification", n);
          console.log("🎯 Sent to user room:", targetId);
        } 
        else if (n.recipientType === "multiple" && Array.isArray(n.userIds)) {
          // ✅ Gửi cho nhiều user (username hoặc _id đều được)
          for (let id of n.userIds) {
            let targetId = id;

            if (!mongoose.isValidObjectId(targetId)) {
              const foundUser = await User.findOne({ username: id });
              if (foundUser) targetId = foundUser._id.toString();
            }

            // ✅ Emit theo room thay vì socketId (fix realtime)
            io.to(targetId.toString()).emit("newNotification", n);
            console.log("🎯 Sent to user room:", targetId);
          }
        }
      }
    }

    return res.status(201).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("❌ Error in createNotification:", error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to send notification." });
  }
};

/** ====================== USER PREFERENCES ====================== */
exports.getUserPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    let pref = await Notification.findOne({
      userId,
      type: "preference",
      isTemplate: false,
    });

    if (!pref) {
      pref = await Notification.create({
        userId,
        title: "User Preferences",
        message: "Notification preferences record",
        type: "preference",
        isTemplate: false,
        preferences: { email: true, web: true },
      });
    }

    res.json({
      preferences: pref.preferences || { email: true, web: true },
    });
  } catch (error) {
    console.error("❌ getUserPreferences:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateUserPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, web } = req.body;

    const updated = await Notification.findOneAndUpdate(
      { userId, type: "preference", isTemplate: false },
      {
        preferences: { email, web },
        title: "User Preferences",
        message: "Notification preferences updated",
        type: "preference",
        isTemplate: false,
      },
      { new: true, upsert: true }
    );

    res.json({
      message: "Preferences updated successfully",
      preferences: updated.preferences,
    });
  } catch (error) {
    console.error("❌ updateUserPreferences:", error);
    res.status(500).json({ error: error.message });
  }
};

/** ====================== ADMIN GET ALL ====================== */
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      isTemplate: false,                     // 🔥 THÊM DÒNG NÀY
      type: { $ne: "preference" },
    })
      .populate("userId", "fullName username email")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type } = req.body;

    const updated = await Notification.findByIdAndUpdate(
      id,
      { title, message, type },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true, notification: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** ====================== USER ====================== */
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({
      isTemplate: false,
      type: { $ne: "preference" },
      $or: [{ userId }, { userId: null }],
    }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    if (notification) {
      // 🔔 Emit Socket.IO event for notification badge update
      const io = req.app.get('io');
      const userId = notification.userId?.toString();
      if (io && userId) {
        io.to(userId).emit('notificationBadgeUpdate', { userId });
      } else if (io && !userId) {
        // Global notification, emit to all users
        io.emit('notificationBadgeUpdate', { userId: null });
      }
    }
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearAll = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await Notification.deleteMany({
      isTemplate: false,
      type: { $ne: "preference" },
      $or: [{ userId }, { userId: null }],
    });

    // 🔔 Emit Socket.IO event for notification badge update
    const io = req.app.get('io');
    if (io && userId) {
      io.to(userId.toString()).emit('notificationBadgeUpdate', { userId });
    } else if (io) {
      // Global notifications cleared, emit to all users
      io.emit('notificationBadgeUpdate', { userId: null });
    }

    res.json({
      message: "Cleared all notifications",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUserNotification = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.userId === null) {
      return res
        .status(403)
        .json({ error: "Cannot delete a global notification" });
    }

    if (notification.userId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "You are not allowed to delete this notification" });
    }

    await Notification.findByIdAndDelete(id);

    // 🔔 Emit Socket.IO event for notification badge update
    const io = req.app.get('io');
    if (io && userId) {
      io.to(userId.toString()).emit('notificationBadgeUpdate', { userId });
    }

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ Error in deleteUserNotification:", error);
    res.status(500).json({ error: error.message });
  }
};

/** ====================== TEMPLATE ====================== */
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await Notification.find({
      isTemplate: true,
    }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates." });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, title, message, type } = req.body;
    if (!name || !title || !message)
      return res.status(400).json({ error: "Missing required fields." });

    const template = new Notification({
      name,
      title,
      message,
      type,
      isTemplate: true,
    });
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to create template." });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, message, type } = req.body;

    const updated = await Notification.findOneAndUpdate(
      { _id: id, isTemplate: true },
      { name, title, message, type },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Template not found." });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update template." });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({
      _id: id,
      isTemplate: true,
    });
    if (!deleted)
      return res.status(404).json({ error: "Template not found." });
    res.json({ message: "Template deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete template." });
  }
};
