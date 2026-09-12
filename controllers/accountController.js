const accountService = require('../services/accountService');

exports.createAccount = async (req, res) => {
  try {
    const result = await accountService.createAccount(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllAccounts = async (req, res) => {
  try {
    const result = await accountService.getAllAccounts();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving accounts', error: error.message });
  }
};

exports.searchAccounts = async (req, res) => {
  try {
    const accounts = await accountService.searchAccountsService(req.query);
    res.status(200).json(accounts);
  } catch (error) {
    res.status(400).json({ message: error.message || "Error searching accounts" });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const result = await accountService.getAccountById(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.message.includes('not found') ? 404 : 403).json({ message: error.message });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const result = await accountService.updateAccount(req.params.id, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const result = await accountService.updateProfile(req.params.id, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await accountService.updatePassword(req.params.id, oldPassword, newPassword, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.softDeleteAccount = async (req, res) => {
  try {
    const result = await accountService.softDeleteAccount(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.disableAccount = async (req, res) => {
  try {
    const result = await accountService.disableAccount(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const result = await accountService.deleteAccount(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.editStaffInformation = async (req, res) => {
  try {
    const result = await accountService.editStaffInformation(req.params.id, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAccountOrderStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== id) {
      return res.status(403).json({ message: 'Access denied: Can only view own order statistics' });
    }
    const result = await accountService.getAccountOrderStatistics(id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};