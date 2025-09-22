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

exports.softDeleteAccount = async (req, res) => {
  try {
    const result = await accountService.softDeleteAccount(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error soft deleting account', error: error.message });
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