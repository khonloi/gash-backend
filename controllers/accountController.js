const accountService = require('../services/accountService');

exports.createAccount = async (req, res) => {
  try {
    const result = await accountService.createAccount(req.body);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error creating account', error: error.message });
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
    res.status(error.status || 500).json({ message: error.message || "Error searching accounts" });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const result = await accountService.getAccountById(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving account', error: error.message });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const result = await accountService.updateAccount(req.params.id, req.body, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error updating account', error: error.message });
  }
};

// Controller update profile
exports.updateProfile = async (req, res) => {
  try {
    // const result = await accountService.updateProfile(req.params.id, req.body, req.user); //for new
    const result = await accountService.updateAccount(req.params.id, req.body, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

// Controller update password
exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await accountService.updatePassword(req.params.id, oldPassword, newPassword, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error updating password', error: error.message });
  }
};


exports.softDeleteAccount = async (req, res) => {
  try {
    const result = await accountService.softDeleteAccount(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error soft deleting account', error: error.message });
  }
};

exports.disableAccount = async (req, res) => {
  try {
    const result = await accountService.disableAccount(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error disabling account', error: error.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const result = await accountService.deleteAccount(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting account', error: error.message });
  }
};

// Edit Staff Information Controller
exports.editStaffInformation = async (req, res) => {
  try {
    const result = await accountService.editStaffInformation(req.params.id, req.body, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error editing staff information', error: error.message });
  }
};

// Get Account Order Statistics Controller
exports.getAccountOrderStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    // Check authorization: only admin, manager, or the user themselves can access
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== id) {
      return res.status(403).json({ message: 'Access denied: Can only view own order statistics' });
    }
    const result = await accountService.getAccountOrderStatistics(id);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving order statistics', error: error.message });
  }
};