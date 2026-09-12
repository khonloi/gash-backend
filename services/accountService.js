const Accounts = require("../models/Accounts");
const Order = require('../models/Order');
const mongoose = require("mongoose");

exports.createAccount = async (data) => {
  const { username, name, email, phone, address, password, image, gender, dob, role } = data;
  const existingAccount = await Accounts.findOne({
    $or: [{ username }, { email }],
  });
  if (existingAccount) {
    throw new Error("Username or email already exists");
  }
  const account = new Accounts({
    username, name, email, phone, address, password,
    image, gender, dob,
    role: role || "user",
    acc_status: "active",
    isEmailVerified: true // Admin created accounts are verified
  });
  const savedAccount = await account.save();
  return {
    message: "Account created successfully",
    account: {
      _id: savedAccount._id, username: savedAccount.username, name: savedAccount.name,
      email: savedAccount.email, phone: savedAccount.phone, address: savedAccount.address,
      image: savedAccount.image, gender: savedAccount.gender, dob: savedAccount.dob,
      role: savedAccount.role, acc_status: savedAccount.acc_status,
    },
  };
};

exports.getAllAccounts = async () => {
  const accounts = await Accounts.find().select("-password -refreshTokens");
  return accounts.map((acc) => acc.toObject());
};

exports.searchAccountsService = async (queryParams) => {
  const { q, role, acc_status, hasImage, dateFrom, dateTo } = queryParams;
  let query = {};
  if (role) query.role = role;
  if (acc_status) query.acc_status = acc_status;
  if (hasImage === "true") {
    query.image = { $ne: "http://localhost:4000/default-pfp.jpg" };
  } else if (hasImage === "false") {
    query.image = "http://localhost:4000/default-pfp.jpg";
  }
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate)) query.createdAt.$gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate)) {
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
  }
  if (q && typeof q === "string" && q.trim() !== "") {
    const trimmedQuery = q.trim();
    query.$or = [
      { username: { $regex: trimmedQuery, $options: "i" } },
      { name: { $regex: trimmedQuery, $options: "i" } },
      { email: { $regex: trimmedQuery, $options: "i" } },
      { phone: { $regex: trimmedQuery, $options: "i" } },
      { address: { $regex: trimmedQuery, $options: "i" } },
      { role: { $regex: trimmedQuery, $options: "i" } },
      { acc_status: { $regex: trimmedQuery, $options: "i" } },
    ];
    if (mongoose.isValidObjectId(trimmedQuery)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(trimmedQuery) });
    }
  }
  const accounts = await Accounts.find(query)
    .select("-password -refreshTokens")
    .sort({ username: 1 });
  return accounts.map((acc) => acc.toObject());
};

exports.getAccountById = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only view own account");
  }
  const account = await Accounts.findById(id).select("-password -refreshTokens");
  if (!account) {
    throw new Error("Account not found");
  }
  return account.toObject();
};

const validateAndApplyUpdates = async (account, data, excludePassword = true) => {
  const { username, email, password, ...updateData } = data;
  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: account._id },
    });
    if (existingAccount) {
      throw new Error("Username or email already exists");
    }
  }
  if (username) account.username = username;
  if (email) account.email = email;
  if (!excludePassword && password) account.password = password; // Should generally use updatePassword instead
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) account[key] = updateData[key];
  });
  await account.save();
  const { password: _, refreshTokens: __, ...accountObj } = account.toObject();
  return accountObj;
};

exports.updateAccount = async (id, data, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only update own account");
  }
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.is_deleted) throw new Error("Cannot update a deleted account");

  const accountObj = await validateAndApplyUpdates(account, data, true);
  return { message: "Account updated successfully", account: accountObj };
};

exports.updateProfile = async (id, data, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only update own profile");
  }
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.is_deleted) throw new Error("Cannot update a deleted account");

  const accountObj = await validateAndApplyUpdates(account, data, true);
  return { message: "Profile updated successfully", account: accountObj };
};

exports.updatePassword = async (id, oldPassword, newPassword, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only update own password");
  }
  const account = await Accounts.findById(id).select("+password");
  if (!account) throw new Error("Account not found");
  if (account.is_deleted) throw new Error("Cannot update a deleted account");

  if (user.role !== "admin") {
    const isMatch = await account.comparePassword(oldPassword);
    if (!isMatch) throw new Error("Old password is incorrect");
  }

  account.password = newPassword;
  account.refreshTokens = []; // Log out from other devices when password changes
  await account.save();
  return { message: "Password updated successfully" };
};

exports.softDeleteAccount = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only soft delete own account");
  }
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.is_deleted) throw new Error("Account is already soft-deleted");

  account.is_deleted = true;
  account.role = "user";
  account.acc_status = "deleted";
  account.refreshTokens = [];
  await account.save();
  return { message: "Account soft deleted successfully" };
};

exports.disableAccount = async (id, user) => {
  if (user.role !== "admin") throw new Error("Access denied: Admin role required");
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.acc_status === "inactive") throw new Error("Account is already disabled");

  account.acc_status = "inactive";
  account.refreshTokens = [];
  await account.save();
  return { message: "Account disabled successfully" };
};

exports.deleteAccount = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    throw new Error("Access denied: Can only delete own account");
  }
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.acc_status === "deleted" && account.is_deleted) {
    throw new Error("Cannot hard delete a soft-deleted account");
  }
  await Accounts.findByIdAndDelete(id);
  return { message: "Account permanently deleted successfully" };
};

exports.editStaffInformation = async (id, data, user) => {
  if (user.role !== "admin") throw new Error("Access denied: Admin role required");
  const account = await Accounts.findById(id);
  if (!account) throw new Error("Account not found");
  if (account.role !== "manager" && account.role !== "admin") {
    throw new Error("Can only edit staff information for manager/admin accounts");
  }
  if (account.is_deleted) throw new Error("Cannot edit information of a deleted account");

  const accountObj = await validateAndApplyUpdates(account, data, true);
  return { message: "Staff information updated successfully", account: accountObj };
};

exports.getAccountOrderStatistics = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new Error("Invalid account ID");

  const orders = await Order.find({ acc_id: id }).select("order_status finalPrice totalPrice");
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.finalPrice || order.totalPrice || 0), 0);
  const activeOrders = orders.filter(order => ['pending', 'confirmed', 'shipping'].includes(order.order_status)).length;

  return { totalOrders, totalSpent, activeOrders };
};
