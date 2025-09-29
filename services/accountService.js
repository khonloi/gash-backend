const Accounts = require('../models/Accounts');
const mongoose = require('mongoose');

exports.createAccount = async (data) => {
  const { username, name, email, phone, address, password, image, role } = data;
  const existingAccount = await Accounts.findOne({ $or: [{ username }, { email }] });
  if (existingAccount) {
    return { status: 400, response: { message: 'Username or email already exists' } };
  }
  const account = new Accounts({
    username,
    name,
    email,
    phone,
    address,
    password,
    image: image || 'http://localhost:4000/default-pfp.jpg',
    role: role || 'user',
    acc_status: 'active'
  });
  const savedAccount = await account.save();
  return {
    status: 201,
    response: {
      message: 'Account created successfully',
      account: {
        _id: savedAccount._id,
        username: savedAccount.username,
        name: savedAccount.name,
        email: savedAccount.email,
        phone: savedAccount.phone,
        address: savedAccount.address,
        image: savedAccount.image,
        role: savedAccount.role,
        acc_status: savedAccount.acc_status
      }
    }
  };
};

exports.getAllAccounts = async () => {
  const accounts = await Accounts.find().select('-password');
  return accounts.map(acc => {
    if (acc.is_deleted) {
      return {
        ...acc.toObject(),
        username: '[deleted]',
        name: '[deleted]',
        email: '[deleted]',
        phone: '[deleted]',
        address: '[deleted]',
        image: '[deleted]',
        google_id: '[deleted]'
      };
    }
    return acc;
  });
};

exports.searchAccountsService = async (queryParams) => {
  const {
    q,
    role,
    acc_status,
    hasImage,
    dateFrom,
    dateTo
  } = queryParams;
  let query = {};
  if (role) {
    query.role = role;
  }
  if (acc_status) {
    query.acc_status = acc_status;
  }
  if (hasImage === 'true') {
    query.image = { $ne: 'http://localhost:4000/default-pfp.jpg' };
  } else if (hasImage === 'false') {
    query.image = 'http://localhost:4000/default-pfp.jpg';
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
  if (q && typeof q === 'string' && q.trim() !== '') {
    const trimmedQuery = q.trim();
    query.$or = [
      { username: { $regex: trimmedQuery, $options: 'i' } },
      { name: { $regex: trimmedQuery, $options: 'i' } },
      { email: { $regex: trimmedQuery, $options: 'i' } },
      { phone: { $regex: trimmedQuery, $options: 'i' } },
      { address: { $regex: trimmedQuery, $options: 'i' } },
      { role: { $regex: trimmedQuery, $options: 'i' } },
      { acc_status: { $regex: trimmedQuery, $options: 'i' } }
    ];
    if (mongoose.isValidObjectId(trimmedQuery)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(trimmedQuery) });
    }
  }
  const accounts = await Accounts.find(query).select('-password').sort({ username: 1 });
  return accounts.map(acc => {
    if (acc.is_deleted) {
      return {
        ...acc.toObject(),
        username: '[deleted]',
        name: '[deleted]',
        email: '[deleted]',
        phone: '[deleted]',
        address: '[deleted]',
        image: '[deleted]',
        google_id: '[deleted]'
      };
    }
    return acc;
  });
};

exports.getAccountById = async (id, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only view own account' } };
  }
  const account = await Accounts.findById(id).select('-password');
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }
  if (account.is_deleted) {
    const deletedAccount = {
      ...account.toObject(),
      username: '[deleted]',
      name: '[deleted]',
      email: '[deleted]',
      phone: '[deleted]',
      address: '[deleted]',
      image: '[deleted]',
      google_id: '[deleted]'
    };
    return { status: 200, response: deletedAccount };
  }
  return { status: 200, response: account };
};

exports.updateAccount = async (id, data, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only update own account' } };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }
  if (account.is_deleted === true) {
    return { status: 403, response: { message: 'Cannot update a deleted account' } };
  }
  const { username, email, ...updateData } = data;
  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: id }
    });
    if (existingAccount) {
      return { status: 400, response: { message: 'Username or email already exists' } };
    }
  }
  // Update fields
  if (username) account.username = username;
  if (email) account.email = email;
  Object.keys(updateData).forEach(key => {
    account[key] = updateData[key];
  });
  await account.save(); // This will trigger the pre-save hook for password hashing
  const { password, ...accountObj } = account.toObject();
  return { status: 200, response: { message: 'Account updated successfully', account: accountObj } };
};




exports.updateProfile = async (id, data, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only update own profile' } };
  }

  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }

  if (account.is_deleted === true) {
    return { status: 403, response: { message: 'Cannot update a deleted account' } };
  }

  // Không cho cập nhật trực tiếp password ở đây
  const { username, email, password, ...updateData } = data;

  if (username || email) {
    const existingAccount = await Accounts.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: id }
    });
    if (existingAccount) {
      return { status: 400, response: { message: 'Username or email already exists' } };
    }
  }

  if (username) account.username = username;
  if (email) account.email = email;
  Object.keys(updateData).forEach(key => {
    account[key] = updateData[key];
  });

  await account.save();

  const { password: _, ...accountObj } = account.toObject();
  return { status: 200, response: { message: 'Profile updated successfully', account: accountObj } };
};

// Đổi mật khẩu
exports.updatePassword = async (id, oldPassword, newPassword, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only update own password' } };
  }

  const account = await Accounts.findById(id).select('+password');
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }

  if (account.is_deleted === true) {
    return { status: 403, response: { message: 'Cannot update a deleted account' } };
  }

  // Nếu không phải admin thì phải check mật khẩu cũ
  if (user.role !== 'admin') {
    const isMatch = await account.comparePassword(oldPassword);
    if (!isMatch) {
      return { status: 400, response: { message: 'Old password is incorrect' } };
    }
  }

  account.password = newPassword; // sẽ được hash bởi pre-save hook
  await account.save();

  return { status: 200, response: { message: 'Password updated successfully' } };
};



exports.softDeleteAccount = async (id, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only soft delete own account' } };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }
  if (account.is_deleted === true) {
    return { status: 403, response: { message: 'Account is already soft-deleted' } };
  }
  account.is_deleted = true;
  account.role = 'user';
  account.acc_status = 'inactive';
  await account.save();
  return { status: 200, response: { message: 'Account soft deleted successfully' } };
};

exports.deleteAccount = async (id, user) => {
  if (user.role !== 'admin' && user.id !== id.toString()) {
    return { status: 403, response: { message: 'Access denied: Can only delete own account' } };
  }
  const account = await Accounts.findById(id);
  if (!account) {
    return { status: 404, response: { message: 'Account not found' } };
  }
  if (account.acc_status === 'inactive' && account.username === 'deleted') {
    return { status: 403, response: { message: 'Cannot hard delete a soft-deleted account' } };
  }
  await Accounts.findByIdAndDelete(id);
  return { status: 200, response: { message: 'Account permanently deleted successfully' } };
};