// authService.js
const Accounts = require('../models/Accounts');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const { generateOTP, storeOTP, verifyStoredOTP } = require('../utils/emailUtils');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');

exports.register = async (data) => {
  const { username, name, email, phone, address, password, image } = data;
  if (!username || !email || !password) {
    return { status: 400, response: { message: 'Username, email, and password are required' } };
  }
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
    image: image || 'https://i.redd.it/1to4yvt3i88c1.png',
    role: 'user',
    accountStatus: 'active'
  });
  const savedAccount = await account.save();
  const token = jwt.sign(
    { id: savedAccount._id, username: savedAccount.username, role: savedAccount.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  return {
    status: 201,
    response: {
      message: 'Registration successful',
      token,
      account: {
        _id: savedAccount._id,
        username: savedAccount.username,
        name: savedAccount.name,
        email: savedAccount.email,
        phone: savedAccount.phone,
        address: savedAccount.address,
        image: savedAccount.image,
        role: savedAccount.role,
        accountStatus: savedAccount.accountStatus
      }
    }
  };
};

exports.verifyRegisterOtp = async (data) => {
  const { email, otp } = data;
  if (!email || !otp) {
    return { status: 400, response: { message: 'Email and OTP are required' } };
  }
  const isValidOTP = await verifyStoredOTP(email, otp);
  if (!isValidOTP) {
    return { status: 400, response: { message: 'Invalid or expired OTP' } };
  }
  return { status: 200, response: { message: 'OTP verified successfully' } };
};

exports.requestForgotPasswordOtp = async (data) => {
  const { email } = data;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { status: 400, response: { message: 'Invalid email address' } };
  }
  const account = await Accounts.findOne({ email });
  if (!account) {
    return { status: 404, response: { message: 'No account found with this email' } };
  }
  const otp = generateOTP();
  const stored = storeOTP(email, otp);
  if (!stored) {
    throw new Error('Failed to store OTP');
  }
  return { status: 200, response: { message: 'OTP generated successfully', otp } };
};

exports.verifyForgotPasswordOtp = async (data) => {
  const { email, otp } = data;
  if (!email || !otp) {
    return { status: 400, response: { message: 'Email and OTP are required' } };
  }
  const account = await Accounts.findOne({ email });
  if (!account) {
    return { status: 404, response: { message: 'No account found with this email' } };
  }
  const isValidOTP = await verifyStoredOTP(email, otp);
  if (!isValidOTP) {
    return { status: 400, response: { message: 'Invalid or expired OTP' } };
  }
  return { status: 200, response: { message: 'OTP verified successfully' } };
};

exports.resetPassword = async (data) => {
  const { email, newPassword } = data;
  if (!email || !newPassword) {
    return { status: 400, response: { message: 'Email and new password are required' } };
  }
  const account = await Accounts.findOne({ email });
  if (!account) {
    return { status: 404, response: { message: 'No account found with this email' } };
  }
  account.password = newPassword;
  await account.save();
  return { status: 200, response: { message: 'Password reset successfully' } };
};

exports.login = async (data) => {
  const { username, password } = data;
  if (!username || !password) {
    return { status: 400, response: { message: 'Username and password are required' } };
  }
  const account = await Accounts.findOne({ username }).select('+password');
  if (!account) {
    return { status: 401, response: { message: 'Invalid username or password' } };
  }
  const isMatch = await account.comparePassword(password);
  if (!isMatch) {
    return { status: 401, response: { message: 'Invalid username or password' } };
  }
  if (account.accountStatus !== 'active') {
    return { status: 403, response: { message: 'Account is inactive or suspended' } };
  }
  const token = jwt.sign(
    { id: account._id, username: account.username, role: account.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  return {
    status: 200,
    response: {
      message: 'Login successful',
      token,
      account: {
        _id: account._id,
        username: account.username,
        name: account.name,
        email: account.email,
        phone: account.phone,
        address: account.address,
        image: account.image,
        role: account.role,
        accountStatus: account.accountStatus
      }
    }
  };
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
    // Generate a random secure password for Google accounts
    const randomPassword = crypto.randomBytes(24).toString('base64');
    account = new Accounts({
      username,
      name: name || username,
      email,
      image: picture || 'https://i.redd.it/1to4yvt3i88c1.png',
      googleId,
      password: randomPassword,
      role: 'user',
      accountStatus: 'active'
    });
    await account.save();
  } else if (!account.googleId) {
    account.googleId = googleId;
    await account.save();
  }
  if (account.accountStatus !== 'active') {
    return { status: 403, response: { message: 'Account is inactive or suspended' } };
  }
  const jwtToken = jwt.sign(
    { id: account._id, username: account.username, role: account.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  return {
    status: 200,
    response: {
      message: 'Google login successful',
      token: jwtToken,
      account: {
        _id: account._id,
        username: account.username,
        name: account.name,
        email: account.email,
        phone: account.phone,
        address: account.address,
        image: account.image,
        role: account.role,
        accountStatus: account.accountStatus
      }
    }
  };
};

exports.requestRegisterOtp = async (data) => {
  const { email } = data;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { status: 400, response: { message: 'Invalid email address' } };
  }
  const existingAccount = await Accounts.findOne({ email });
  if (existingAccount) {
    return { status: 400, response: { message: 'Email already registered' } };
  }
  const otp = generateOTP();
  const stored = storeOTP(email, otp);
  if (!stored) {
    throw new Error('Failed to store OTP');
  }
  return { status: 200, response: { message: 'OTP generated successfully', otp } };
};

// Verify password for checkout authentication
exports.verifyPassword = async (userId, password) => {
  try {
    const account = await Accounts.findById(userId).select('+password');
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }
    
    // Check if user has a password (not a Google-only user)
    if (!account.password) {
      return { status: 400, response: { message: 'Password authentication not available for this account' } };
    }
    
    const isMatch = await account.comparePassword(password);
    if (!isMatch) {
      return { status: 401, response: { message: 'Invalid password' } };
    }
    
    return { status: 200, response: { message: 'Password verified successfully', verified: true } };
  } catch (error) {
    console.error('Error verifying password:', error);
    return { status: 500, response: { message: 'Error verifying password', error: error.message } };
  }
};

// Update requireAuthForCheckout setting
exports.updateCheckoutAuthSetting = async (userId, requireAuth) => {
  try {
    const account = await Accounts.findById(userId);
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }
    
    account.requireAuthForCheckout = requireAuth;
    await account.save();
    
    return { 
      status: 200, 
      response: { 
        message: 'Checkout authentication setting updated successfully',
        requireAuthForCheckout: account.requireAuthForCheckout
      } 
    };
  } catch (error) {
    console.error('Error updating checkout auth setting:', error);
    return { status: 500, response: { message: 'Error updating setting', error: error.message } };
  }
}; 