// authController.js
const authService = require('../services/authService');

exports.register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

exports.verifyRegisterOtp = async (req, res) => {
  try {
    const result = await authService.verifyRegisterOtp(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

exports.requestForgotPasswordOtp = async (req, res) => {
  try {
    const result = await authService.requestForgotPasswordOtp(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error generating OTP', error: error.message });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const result = await authService.verifyForgotPasswordOtp(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const result = await authService.googleLogin(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error with Google login', error: error.message });
  }
};

exports.requestRegisterOtp = async (req, res) => {
  try {
    const result = await authService.requestRegisterOtp(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error generating OTP', error: error.message });
  }
};

// Added: Endpoint for status check (to be protected by authenticateJWT in routes)
exports.checkStatus = async (req, res) => {
  res.status(200).json({ message: 'Account is active' });
};

// Verify password for checkout
exports.verifyPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const result = await authService.verifyPassword(userId, password);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error verifying password', error: error.message });
  }
};

// Update checkout authentication setting
exports.updateCheckoutAuthSetting = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requireAuth } = req.body;
    if (typeof requireAuth !== 'boolean') {
      return res.status(400).json({ message: 'requireAuth must be a boolean' });
    }
    const result = await authService.updateCheckoutAuthSetting(userId, requireAuth);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error updating setting', error: error.message });
  }
};