const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const accountController = require('../controllers/accountController');

// Create a new account (Admin only)
router.post('/', authenticateJWT, authorizeRole(['admin']), accountController.createAccount);

// Get all accounts (Admin only)
router.get('/', authenticateJWT, authorizeRole(['admin']), accountController.getAllAccounts);

// Get a single account by ID (Admin or self)
router.get('/:id', authenticateJWT, accountController.getAccountById);

// Update an account (Admin or self)
router.put('/:id', authenticateJWT, accountController.updateAccount);

// Soft delete an account (Admin or self)
router.delete('/soft/:id', authenticateJWT, accountController.softDeleteAccount);

// Delete an account permanently (Admin or self)
router.delete('/:id', authenticateJWT, accountController.deleteAccount);

module.exports = router;