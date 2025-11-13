const Notification = require("../models/Notification");
const Accounts = require("../models/Accounts");

/** ====================== CREATE NOTIFICATION ====================== */
exports.createNotificationService = async (data) => {
  const { title, message, recipientType, user, userId, type, userIds } = data;
  const targetId = user || userId;

  if (!title || !message) throw new Error("Title and message are required");

  let targets = [];

  if (recipientType === "specific" && targetId) {
    const foundUser =
      (await Accounts.findOne({ username: targetId })) ||
      (await Accounts.findById(targetId));
    if (!foundUser) throw new Error("User not found");
    targets = [foundUser._id];
  } else if (recipientType === "all") {
    const users = await Accounts.find({}, "_id");
    targets = users.map((u) => u._id);
  } else if (recipientType === "multiple" && Array.isArray(userIds)) {
    const foundUsers = [];
    for (const item of userIds) {
      let userFound = null;
      if (/^[0-9a-fA-F]{24}$/.test(item)) {
        userFound = await Accounts.findById(item);
      }
      if (!userFound) {
        userFound = await Accounts.findOne({ username: item });
      }
      if (userFound) {
        foundUsers.push(userFound);
      }
    }
    if (foundUsers.length === 0) throw new Error("No valid recipients found");
    targets = foundUsers.map((u) => u._id);
  }

  if (targets.length === 0) throw new Error("No valid recipients found");

  const notifications = await Promise.all(
    targets.map(async (uid) => {
      const noti = new Notification({
        title,
        message,
        userId: uid,
        type,
        createdAt: new Date(),
        isTemplate: false,
      });
      return await noti.save();
    })
  );

  return notifications;
};

/** ====================== USER PREFERENCES ====================== */
exports.getUserPreferences = async (userId) => {
  const account = await Accounts.findById(userId);
  if (!account) throw new Error("User not found");

  if (!account.preferences) {
    account.preferences = { email: true, web: true };
    await account.save();
  }

  return account.preferences;
};

exports.updateUserPreferences = async (userId, prefs) => {
  const account = await Accounts.findById(userId);
  if (!account) throw new Error("User not found");

  account.preferences = {
    ...account.preferences,
    email: prefs.email ?? account.preferences.email,
    web: prefs.web ?? account.preferences.web,
  };

  await account.save();
  return account.preferences;
};
