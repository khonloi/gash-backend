const authService = require('../services/authService');

exports.requestRegisterOtp = async (req, res) => {
  try {
    const result = await authService.requestRegisterOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.verifyRegisterOtp = async (req, res) => {
  try {
    const result = await authService.verifyRegisterOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

exports.refreshAccessToken = async (req, res) => {
  try {
    const result = await authService.refreshAccessToken(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const result = await authService.googleLogin(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.requestForgotPasswordOtp = async (req, res) => {
  try {
    const result = await authService.requestForgotPasswordOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const result = await authService.verifyForgotPasswordOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.checkStatus = async (req, res) => {
  res.status(200).json({ message: 'Account is active' });
};