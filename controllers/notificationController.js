const notificationService = require("../services/notificationService");
const { connectedUsers } = require("../sockets/notificationSocket");

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
      const prefsMap = await notificationService.getUsersPreferencesMapService(userIds);

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const data = await notificationService.getAllNotificationsService(page, limit);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await notificationService.updateNotificationService(id, req.body);
    res.json({ success: true, notification: updated });
  } catch (error) {
    if (error.message === "Notification not found") {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(500).json({ error: "Failed to update notification" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await notificationService.deleteNotificationService(req.params.id);

    const userId = notification.userId ? notification.userId.toString() : null;
    const notificationId = notification._id.toString();

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
    if (error.message === "Notification not found") {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

/** ====================== USER ====================== */
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const data = await notificationService.getUserNotificationsService(userId, page, limit);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsReadService(req.params.id);
    
    // Emit Socket.IO event for notification badge update
    const io = req.app.get('io');
    const userId = notification.userId?.toString();
    if (io && userId) {
      io.to(userId).emit('notificationBadgeUpdate', { userId });
    } else if (io && !userId) {
      // Global notification, emit to all users
      io.emit('notificationBadgeUpdate', { userId: null });
    }
    
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearAll = async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedCount = await notificationService.clearAllService(userId);

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
      deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUserNotification = async (req, res) => {
  try {
    const { userId, id } = req.params;
    
    await notificationService.deleteUserNotificationService(userId, id);

    // Emit Socket.IO event for notification badge update
    const io = req.app.get('io');
    if (io && userId) {
      io.to(userId.toString()).emit('notificationBadgeUpdate', { userId });
    }

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUserNotification:", error);
    if (error.message === "Notification not found") {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (error.message === "Cannot delete a global notification" || error.message === "You are not allowed to delete this notification") {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/** ====================== TEMPLATE ====================== */
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await notificationService.getAllTemplatesService();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates." });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const template = await notificationService.createTemplateService(req.body);
    res.status(201).json(template);
  } catch (error) {
    if (error.message === "Missing required fields.") {
      return res.status(400).json({ error: "Missing required fields." });
    }
    res.status(500).json({ error: "Failed to create template." });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await notificationService.updateTemplateService(id, req.body);
    res.json(updated);
  } catch (error) {
    if (error.message === "Template not found.") {
      return res.status(404).json({ error: "Template not found." });
    }
    res.status(500).json({ error: "Failed to update template." });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteTemplateService(id);
    res.json({ message: "Template deleted successfully." });
  } catch (error) {
    if (error.message === "Template not found.") {
      return res.status(404).json({ error: "Template not found." });
    }
    res.status(500).json({ error: "Failed to delete template." });
  }
};
