const notificationService = require("../services/notificationService");
const { connectedUsers } = require("../sockets/notificationSocket");
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

/** ====================== ADMIN ====================== */
exports.createNotification = catchAsync(async (req, res) => {
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

  res.status(201).json({
    success: true,
    count: notifications.length,
    notifications,
  });
});

/** ====================== USER PREFERENCES ====================== */
exports.getUserPreferences = catchAsync(async (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
    throw new AppError("Access denied", 403);
  }
  const preferences = await notificationService.getUserPreferences(userId);
  if (!preferences) throw new AppError("User not found", 404);
  res.status(200).json({ success: true, preferences });
});

exports.updateUserPreferences = catchAsync(async (req, res) => {
  const { userId } = req.params;
  if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== userId) {
    throw new AppError("Access denied", 403);
  }
  const preferences = await notificationService.updateUserPreferences(userId, req.body);
  if (!preferences) throw new AppError("User not found", 404);
  res.status(200).json({
    success: true,
    message: "Preferences updated successfully",
    preferences,
  });
});

/** ====================== ADMIN GET ALL ====================== */
exports.getAllNotifications = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const data = await notificationService.getAllNotificationsService(page, limit);
  res.status(200).json({ success: true, ...data });
});

exports.updateNotification = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updated = await notificationService.updateNotificationService(id, req.body);
  if (!updated) throw new AppError("Notification not found", 404);
  res.status(200).json({ success: true, notification: updated });
});

exports.deleteNotification = catchAsync(async (req, res) => {
  const notification = await notificationService.deleteNotificationService(req.params.id);
  if (!notification) throw new AppError("Notification not found", 404);

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

  res.status(200).json({ success: true, message: "Deleted successfully" });
});

/** ====================== USER ====================== */
exports.getUserNotifications = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const data = await notificationService.getUserNotificationsService(userId, page, limit);
  res.status(200).json({ success: true, ...data });
});

exports.markAsRead = catchAsync(async (req, res) => {
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
  
  res.status(200).json({ success: true, message: "Marked as read" });
});

exports.clearAll = catchAsync(async (req, res) => {
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

  res.status(200).json({
    success: true,
    message: "Cleared all notifications",
    deletedCount,
  });
});

exports.deleteUserNotification = catchAsync(async (req, res) => {
  const { userId, id } = req.params;
  
  try {
    await notificationService.deleteUserNotificationService(userId, id);
  } catch (err) {
    if (err.message === "Notification not found") throw new AppError(err.message, 404);
    if (err.message === "Cannot delete a global notification" || err.message === "You are not allowed to delete this notification") {
      throw new AppError(err.message, 403);
    }
    throw err;
  }

  // Emit Socket.IO event for notification badge update
  const io = req.app.get('io');
  if (io && userId) {
    io.to(userId.toString()).emit('notificationBadgeUpdate', { userId });
  }

  res.status(200).json({ success: true, message: "Deleted successfully" });
});

/** ====================== TEMPLATE ====================== */
exports.getAllTemplates = catchAsync(async (req, res) => {
  const templates = await notificationService.getAllTemplatesService();
  res.status(200).json({ success: true, templates });
});

exports.createTemplate = catchAsync(async (req, res) => {
  try {
    const template = await notificationService.createTemplateService(req.body);
    res.status(201).json({ success: true, template });
  } catch (err) {
    if (err.message === "Missing required fields.") throw new AppError(err.message, 400);
    throw err;
  }
});

exports.updateTemplate = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updated = await notificationService.updateTemplateService(id, req.body);
  if (!updated) throw new AppError("Template not found.", 404);
  res.status(200).json({ success: true, template: updated });
});

exports.deleteTemplate = catchAsync(async (req, res) => {
  const { id } = req.params;
  try {
    await notificationService.deleteTemplateService(id);
    res.status(200).json({ success: true, message: "Template deleted successfully." });
  } catch (err) {
    if (err.message === "Template not found.") throw new AppError(err.message, 404);
    throw err;
  }
});
