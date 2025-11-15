const Accounts = require("../models/Accounts");
const Orders = require("../models/Orders");
const mongoose = require("mongoose");

exports.createAccount = async (data) => {
  const {
    username,
    name,
    email,
    phone,
    address,
    password,
    image,
    gender,
    dob,
    role,
  } = data;
  const existingAccount = await Accounts.findOne({
    $or: [{ username }, { email }],
  });
  if (existingAccount) {
    return {
      status: 400,
      response: { message: "Username or email already exists" },
    };
  }
  const account = new Accounts({
    username,
    name,
    email,
    phone,
    address,
    password,
    image: image,
    gender,
    dob,
    role: role || "user",
    acc_status: "active",
  });
  const savedAccount = await account.save();
  return {
    status: 201,
    response: {
      message: "Account created successfully",
      account: {
        _id: savedAccount._id,
        username: savedAccount.username,
        name: savedAccount.name,
        email: savedAccount.email,
        phone: savedAccount.phone,
        address: savedAccount.address,
        image: savedAccount.image,
        gender: savedAccount.gender,
        dob: savedAccount.dob,
        role: savedAccount.role,
        acc_status: savedAccount.acc_status,
      },
    },
  };
};

exports.getAllAccounts = async () => {
  const accounts = await Accounts.find().select("-password");
  return accounts.map((acc) => acc.toObject());
};

exports.searchAccountsService = async (queryParams) => {
  const { q, role, acc_status, hasImage, dateFrom, dateTo } = queryParams;
  let query = {};
  if (role) {
    query.role = role;
  }
  if (acc_status) {
    query.acc_status = acc_status;
  }
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
    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
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
    .select("-password")
    .sort({ username: 1 });
  return accounts.map((acc) => acc.toObject());
};

exports.getAccountById = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only view own account" },
    };
  }
  const account = await Accounts.findById(id).select("-password");
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }
  return { status: 200, response: account.toObject() };
};

exports.updateAccount = async (id, data, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only update own account" },
    };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }
  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Cannot update a deleted account" },
    };
  }
  const { username, email, ...updateData } = data;
  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: id },
    });
    if (existingAccount) {
      return {
        status: 400,
        response: { message: "Username or email already exists" },
      };
    }
  }
  // Update fields
  if (username) account.username = username;
  if (email) account.email = email;
  Object.keys(updateData).forEach((key) => {
    account[key] = updateData[key];
  });
  await account.save(); // This will trigger the pre-save hook for password hashing
  const { password, ...accountObj } = account.toObject();
  return {
    status: 200,
    response: { message: "Account updated successfully", account: accountObj },
  };
};

exports.updateProfile = async (id, data, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only update own profile" },
    };
  }

  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }

  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Cannot update a deleted account" },
    };
  }

  // Không cho cập nhật trực tiếp password ở đây
  const { username, email, password, ...updateData } = data;

  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: id },
    });
    if (existingAccount) {
      return {
        status: 400,
        response: { message: "Username or email already exists" },
      };
    }
  }

  if (username) account.username = username;
  if (email) account.email = email;
  Object.keys(updateData).forEach((key) => {
    account[key] = updateData[key];
  });

  await account.save();

  const { password: _, ...accountObj } = account.toObject();
  return {
    status: 200,
    response: { message: "Profile updated successfully", account: accountObj },
  };
};

// Đổi mật khẩu
exports.updatePassword = async (id, oldPassword, newPassword, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only update own password" },
    };
  }

  const account = await Accounts.findById(id).select("+password");
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }

  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Cannot update a deleted account" },
    };
  }

  // Nếu không phải admin thì phải check mật khẩu cũ
  if (user.role !== "admin") {
    const isMatch = await account.comparePassword(oldPassword);
    if (!isMatch) {
      return {
        status: 400,
        response: { message: "Old password is incorrect" },
      };
    }
  }

  account.password = newPassword; // sẽ được hash bởi pre-save hook
  await account.save();

  return {
    status: 200,
    response: { message: "Password updated successfully" },
  };
};

exports.softDeleteAccount = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only soft delete own account" },
    };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }
  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Account is already soft-deleted" },
    };
  }
  account.role = "user";
  account.acc_status = "inactive";
  await account.save();
  return {
    status: 200,
    response: { message: "Account soft deleted successfully" },
  };
};

exports.disableAccount = async (id, user) => {
  if (user.role !== "admin") {
    return {
      status: 403,
      response: { message: "Access denied: Admin role required" },
    };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }
  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Account is already disabled" },
    };
  }
  account.acc_status = "inactive";
  await account.save();
  return {
    status: 200,
    response: { message: "Account disabled successfully" },
  };
};

exports.deleteAccount = async (id, user) => {
  if (user.role !== "admin" && user.id !== id.toString()) {
    return {
      status: 403,
      response: { message: "Access denied: Can only delete own account" },
    };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }
  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Cannot hard delete a soft-deleted account" },
    };
  }
  await Accounts.findByIdAndDelete(id);
  return {
    status: 200,
    response: { message: "Account permanently deleted successfully" },
  };
};

// Edit Staff Information - Admin only, for staff accounts (manager/admin roles)
exports.editStaffInformation = async (id, data, user) => {
  if (user.role !== "admin") {
    return {
      status: 403,
      response: { message: "Access denied: Admin role required" },
    };
  }

  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: "Account not found" } };
  }

  // Check if account is a staff member (manager or admin)
  if (account.role !== "manager" && account.role !== "admin") {
    return {
      status: 403,
      response: {
        message: "Can only edit staff information for manager/admin accounts",
      },
    };
  }

  if (account.acc_status === "inactive") {
    return {
      status: 403,
      response: { message: "Cannot edit information of a deleted account" },
    };
  }

  const { username, email, password, ...updateData } = data;

  // Check for duplicate username/email
  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: id },
    });
    if (existingAccount) {
      return {
        status: 400,
        response: { message: "Username or email already exists" },
      };
    }
  }

  // Update fields
  if (username) account.username = username;
  if (email) account.email = email;
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      account[key] = updateData[key];
    }
  });

  await account.save();

  const { password: _, ...accountObj } = account.toObject();
  return {
    status: 200,
    response: {
      message: "Staff information updated successfully",
      account: accountObj,
    },
  };
};

exports.getAccountOrderStatistics = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    return {
      status: 400,
      response: { message: "Invalid account ID" },
    };
  }

  const orders = await Orders.find({ acc_id: id })
    .select('order_status finalPrice totalPrice');

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => {
    return sum + (order.finalPrice || order.totalPrice || 0);
  }, 0);
  const activeOrders = orders.filter(order =>
    ['pending', 'confirmed', 'shipping'].includes(order.order_status)
  ).length;

  return {
    status: 200,
    response: {
      totalOrders,
      totalSpent,
      activeOrders
    },
  };
};
