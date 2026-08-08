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
