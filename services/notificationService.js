const Notification = require("../models/Notification");
const Accounts = require("../models/Accounts");

/** ====================== CREATE NOTIFICATION ====================== */
exports.createNotificationService = async (data) => {
  const { title, message, recipientType, user, userId, type, userIds } = data;
  const targetId = user || userId;

  if (!title || !message) throw new Error("Title and message are required");

  let targets = [];

  if (recipientType === "specific" && targetId) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(targetId);
    const query = isObjectId ? { $or: [{ _id: targetId }, { username: targetId }] } : { username: targetId };
    const foundUser = await Accounts.findOne(query);
    if (!foundUser) throw new Error("User not found");
    targets = [foundUser._id];
  } else if (recipientType === "all") {
    // Only include users who have web notifications enabled (or not explicitly disabled)
    const users = await Accounts.find({ "preferences.web": { $ne: false } }, "_id");
    targets = users.map((u) => u._id);
  } else if (recipientType === "multiple" && Array.isArray(userIds)) {
    const objectIds = [];
    const usernames = [];
    
    for (const item of userIds) {
      if (/^[0-9a-fA-F]{24}$/.test(item)) {
        objectIds.push(item);
      } else {
        usernames.push(item);
      }
    }
    
    const query = { $or: [] };
    if (objectIds.length > 0) query.$or.push({ _id: { $in: objectIds } });
    if (usernames.length > 0) query.$or.push({ username: { $in: usernames } });
    
    if (query.$or.length > 0) {
      const foundUsers = await Accounts.find(query, "_id");
      targets = foundUsers.map((u) => u._id);
    }
    
    if (targets.length === 0) throw new Error("No valid recipients found");
  }

  if (targets.length === 0) throw new Error("No valid recipients found");

  const docs = targets.map((uid) => ({
    title,
    message,
    userId: uid,
    type,
    createdAt: new Date(),
    isTemplate: false,
  }));

  const notifications = await Notification.insertMany(docs);
  return notifications;
};

/** ====================== USER PREFERENCES ====================== */
exports.getUserPreferences = async (userId) => {
  const account = await Accounts.findById(userId);
  if (!account) throw new Error("User not found");

  return account.preferences || { email: true, web: true };
};

exports.updateUserPreferences = async (userId, prefs) => {
  const account = await Accounts.findById(userId);
  if (!account) throw new Error("User not found");

  account.preferences = {
    email: prefs.email ?? account.preferences?.email ?? true,
    web: prefs.web ?? account.preferences?.web ?? true,
  };

  await account.save();
  return account.preferences;
};

/** ====================== ADMIN ====================== */
exports.getAllNotificationsService = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const query = { type: { $ne: "preference" } };

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .populate("userId", "fullName username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query)
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

exports.updateNotificationService = async (id, data) => {
  const { title, message, type } = data;
  const updated = await Notification.findByIdAndUpdate(
    id,
    { title, message, type },
    { new: true }
  );
  if (!updated) throw new Error("Notification not found");
  return updated;
};

exports.deleteNotificationService = async (id) => {
  const notification = await Notification.findById(id);
  if (!notification) throw new Error("Notification not found");
  
  await Notification.findByIdAndDelete(id);
  return notification; // Return deleted notification for socket emit
};

/** ====================== USER ====================== */
exports.getUserNotificationsService = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const query = {
    isTemplate: false,
    type: { $ne: "preference" },
    $or: [{ userId }, { userId: null }],
  };

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query)
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

exports.markAsReadService = async (id) => {
  const notification = await Notification.findByIdAndUpdate(id, { isRead: true });
  if (!notification) throw new Error("Notification not found");
  return notification;
};

exports.clearAllService = async (userId) => {
  const result = await Notification.deleteMany({
    isTemplate: false,
    type: { $ne: "preference" },
    $or: [{ userId }, { userId: null }],
  });
  return result.deletedCount;
};

exports.deleteUserNotificationService = async (userId, id) => {
  const notification = await Notification.findById(id);
  if (!notification) throw new Error("Notification not found");
  
  if (notification.userId === null) {
    throw new Error("Cannot delete a global notification");
  }
  
  if (notification.userId.toString() !== userId.toString()) {
    throw new Error("You are not allowed to delete this notification");
  }
  
  await Notification.findByIdAndDelete(id);
  return notification;
};

/** ====================== TEMPLATE ====================== */
exports.getAllTemplatesService = async () => {
  return await Notification.find({ isTemplate: true }).sort({ createdAt: -1 });
};

exports.createTemplateService = async (data) => {
  const { name, title, message, type } = data;
  if (!name || !title || !message) throw new Error("Missing required fields.");
  
  const template = new Notification({
    name,
    title,
    message,
    type,
    isTemplate: true,
  });
  await template.save();
  return template;
};

exports.updateTemplateService = async (id, data) => {
  const { name, title, message, type } = data;
  const updated = await Notification.findOneAndUpdate(
    { _id: id, isTemplate: true },
    { name, title, message, type },
    { new: true }
  );
  if (!updated) throw new Error("Template not found.");
  return updated;
};

exports.deleteTemplateService = async (id) => {
  const deleted = await Notification.findOneAndDelete({
    _id: id,
    isTemplate: true,
  });
  if (!deleted) throw new Error("Template not found.");
  return deleted;
};

exports.getUsersPreferencesMapService = async (userIds) => {
  const prefsMap = new Map();
  if (userIds.length > 0) {
    const users = await Accounts.find({ _id: { $in: userIds } }, 'preferences');
    users.forEach(u => prefsMap.set(u._id.toString(), u.preferences || { email: true, web: true }));
  }
  return prefsMap;
};
