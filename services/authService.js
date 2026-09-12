const Accounts = require('../models/Accounts');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const { generateOTP, storeOTP, verifyStoredOTP } = require('../utils/emailUtils');
const tempStore = require('../utils/tempStore');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const generateTokens = (account) => {
  const payload = { id: account._id, username: account.username, role: account.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

exports.requestRegisterOtp = async (data) => {
  const { email } = data;
  const existingAccount = await Accounts.findOne({ email });
  if (existingAccount) {
    throw new Error('Email already registered');
  }
  const otp = generateOTP();
  const stored = storeOTP(email, otp);
  if (!stored) {
    throw new Error('Failed to store OTP');
  }
  return { message: 'OTP generated successfully', otp }; // Remove 'otp' in production!
};

exports.verifyRegisterOtp = async (data) => {
  const { email, otp, registrationData } = data;
  const isValidOTP = await verifyStoredOTP(email, otp);
  if (!isValidOTP) {
    throw new Error('Invalid or expired OTP');
  }
  // Store validated user data temporarily until they call register
  tempStore.setTempUser(email, registrationData);
  return { message: 'OTP verified successfully. Proceed to register.' };
};

exports.register = async (data) => {
  const { email } = data;
  const tempUserData = tempStore.getTempUser(email);
  if (!tempUserData) {
    throw new Error('Registration timeout or OTP not verified. Please request OTP again.');
  }

  const { username, name, phone, address, password, image } = tempUserData;
  const existingAccount = await Accounts.findOne({ $or: [{ username }, { email }] });
  if (existingAccount) {
    throw new Error('Username or email already exists');
  }

  const account = new Accounts({
    username,
    name,
    email,
    phone,
    address,
    password,
    image: image || 'http://localhost:4000/default-pfp.jpg',
    role: 'user',
    acc_status: 'active',
    isEmailVerified: true
  });
  
  const savedAccount = await account.save();
  tempStore.deleteTempUser(email);

  const { accessToken, refreshToken } = generateTokens(savedAccount);
  savedAccount.refreshTokens.push(refreshToken);
  await savedAccount.save();

  return {
    message: 'Registration successful',
    accessToken,
    refreshToken,
    account: {
      _id: savedAccount._id,
      username: savedAccount.username,
      name: savedAccount.name,
      email: savedAccount.email,
      role: savedAccount.role,
      acc_status: savedAccount.acc_status
    }
  };
};

exports.login = async (data) => {
  const { username, password } = data;
  
  // Find by username or email
  const account = await Accounts.findOne({
    $or: [{ username }, { email: username.toLowerCase() }]
  }).select('+password');

  if (!account) {
    throw new Error('Invalid username or password');
  }

  if (account.acc_status !== 'active') {
    throw new Error('Account is inactive or suspended');
  }

  // Check if account is locked
  if (account.lockUntil && account.lockUntil > Date.now()) {
    throw new Error('Account is locked. Please try again later.');
  }

  const isMatch = await account.comparePassword(password);
  
  if (!isMatch) {
    account.failedLoginAttempts += 1;
    if (account.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      account.lockUntil = Date.now() + LOCK_TIME;
    }
    await account.save();
    throw new Error('Invalid username or password');
  }

  // Successful login, reset attempts
  account.failedLoginAttempts = 0;
  account.lockUntil = undefined;

  const { accessToken, refreshToken } = generateTokens(account);
  account.refreshTokens.push(refreshToken);
  await account.save();

  return {
    message: 'Login successful',
    accessToken,
    refreshToken,
    account: {
      _id: account._id,
      username: account.username,
      name: account.name,
      email: account.email,
      role: account.role,
      acc_status: account.acc_status
    }
  };
};

exports.refreshAccessToken = async (data) => {
  const { refreshToken } = data;
  if (!refreshToken) throw new Error('Refresh token is required');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }

  const account = await Accounts.findById(decoded.id);
  if (!account || !account.refreshTokens.includes(refreshToken)) {
    throw new Error('Invalid refresh token');
  }

  if (account.acc_status !== 'active') {
    throw new Error('Account is inactive or suspended');
  }

  const payload = { id: account._id, username: account.username, role: account.role };
  const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  
  return { accessToken: newAccessToken };
};

exports.googleLogin = async (data) => {
  const { token } = data;
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  
  const { email, name, picture, sub: googleId } = ticket.getPayload();
  let account = await Accounts.findOne({ email });
  
  if (!account) {
    const username = email.split('@')[0];
    const randomPassword = crypto.randomBytes(24).toString('base64');
    account = new Accounts({
      username,
      name: name || username,
      email,
      image: picture || 'http://localhost:4000/default-pfp.jpg',
      googleId,
      password: randomPassword,
      role: 'user',
      acc_status: 'active',
      isEmailVerified: true
    });
    await account.save();
  } else if (!account.googleId) {
    account.googleId = googleId;
    account.isEmailVerified = true;
    await account.save();
  }

  if (account.acc_status !== 'active') {
    throw new Error('Account is inactive or suspended');
  }

  const { accessToken, refreshToken } = generateTokens(account);
  account.refreshTokens.push(refreshToken);
  await account.save();

  return {
    message: 'Google login successful',
    accessToken,
    refreshToken,
    account: {
      _id: account._id,
      username: account.username,
      name: account.name,
      email: account.email,
      role: account.role,
      acc_status: account.acc_status
    }
  };
};

exports.requestForgotPasswordOtp = async (data) => {
  const { email } = data;
  const account = await Accounts.findOne({ email });
  if (!account) {
    throw new Error('No account found with this email'); // Consider returning a generic message in production to prevent user enumeration
  }
  const otp = generateOTP();
  const stored = storeOTP(email, otp);
  if (!stored) {
    throw new Error('Failed to store OTP');
  }
  return { message: 'OTP generated successfully', otp }; // Remove 'otp' in production
};

exports.verifyForgotPasswordOtp = async (data) => {
  const { email, otp } = data;
  const account = await Accounts.findOne({ email });
  if (!account) {
    throw new Error('No account found with this email');
  }
  const isValidOTP = await verifyStoredOTP(email, otp);
  if (!isValidOTP) {
    throw new Error('Invalid or expired OTP');
  }
  
  // Generate a temporary reset token valid for 15 minutes
  const resetToken = jwt.sign({ id: account._id, email: account.email, purpose: 'resetPassword' }, JWT_SECRET, { expiresIn: '15m' });
  return { message: 'OTP verified successfully', resetToken };
};

exports.resetPassword = async (data) => {
  const { resetToken, newPassword } = data;
  let decoded;
  try {
    decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.purpose !== 'resetPassword') throw new Error('Invalid token purpose');
  } catch (err) {
    throw new Error('Invalid or expired reset token');
  }

  const account = await Accounts.findById(decoded.id);
  if (!account) {
    throw new Error('Account not found');
  }

  account.password = newPassword;
  // Invalidate existing sessions
  account.refreshTokens = [];
  await account.save();

  return { message: 'Password reset successfully. All existing sessions have been invalidated.' };
};