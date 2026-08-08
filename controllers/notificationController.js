const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const { connectedUsers } = require("../sockets/notificationSocket");
const User = require("../models/Accounts");

/** ====================== ADMIN ====================== */
exports.createNotification = async (req, res) => {
  try {
    const { recipientType } = req.body;
    const notifications = await notificationService.createNotificationService(req.body);

    /** Realtime emit via Socket.IO */
    const io = req.app.get("io");

    if (io && notifications?.length) {
      // Pre-fetch all user preferences in a single query to avoid N+1
      const userIds = [...new Set(notifications.filter(n => n.userId).map(n => n.userId.toString()))];
      let prefsMap = new Map();
      
      if (userIds.length > 0) {
        try {
          const users = await User.find({ _id: { $in: userIds } }, 'preferences');
          users.forEach(u => prefsMap.set(u._id.toString(), u.preferences || { email: true, web: true }));
        } catch (err) {
          console.error("Error pre-fetching user preferences:", err);
        }
      }

      // Emit each notification to its specific user room, but only if user has web notifications enabled
      for (const n of notifications) {
        if (n.userId) {
          const targetId = n.userId.toString();
          const prefs = prefsMap.get(targetId) || { email: true, web: true };
          
          if (prefs.web) {
            io.to(targetId).emit("newNotification", n);
          }
        } else {
          // If userId is null, it's a global notification - emit to all
          io.emit("newNotification", n);
        }
      }
    }

    return res.status(201).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Error in createNotification:", error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to send notification." });
  }
};

/** ====================== USER PREFERENCES ====================== */
exports.getUserPreferences = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const preferences = await notificationService.getUserPreferences(userId);
    res.json({ preferences });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    next(error);
  }
};

exports.updateUserPreferences = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const preferences = await notificationService.updateUserPreferences(userId, req.body);
    res.json({
      success: true,
      message: "Preferences updated successfully",
      preferences,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    next(error);
  }
};

/** ====================== ADMIN GET ALL ====================== */
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
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
    // Get notification before deleting to know who to notify
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const userId = notification.userId ? notification.userId.toString() : null;
    const notificationId = notification._id.toString();

    // Delete the notification
    await Notification.findByIdAndDelete(req.params.id);

    // Emit Socket.IO event to notify recipients
    const io = req.app.get("io");
    if (io) {
      const deleteEvent = { notificationId, userId };
      
      if (userId) {
        // Notify specific user - emit to multiple room formats for compatibility
        io.to(userId).emit("notificationDeleted", deleteEvent);
        io.to(`user_${userId}`).emit("notificationDeleted", deleteEvent);
        
        // Also emit to the socket ID if we have it
        const socketId = connectedUsers.get(userId);
        if (socketId) {
          io.to(socketId).emit("notificationDeleted", deleteEvent);
        }
      } else {
        // Global notification - notify all users
        io.emit("notificationDeleted", deleteEvent);
      }
    } else {
      console.warn("Socket.IO not available in deleteNotification");
    }

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
      // Emit Socket.IO event for notification badge update
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

    // Emit Socket.IO event for notification badge update
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

    // Emit Socket.IO event for notification badge update
    const io = req.app.get('io');
    if (io && userId) {
      io.to(userId.toString()).emit('notificationBadgeUpdate', { userId });
    }

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUserNotification:", error);
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
