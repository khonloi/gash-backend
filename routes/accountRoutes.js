const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const accountController = require('../controllers/accountController');

// Create a new account (Admin only)
router.post('/', authenticateJWT, authorizeRole(['admin']), accountController.createAccount);

// Get all accounts (Admin only)
router.get('/', authenticateJWT, authorizeRole(['admin']), accountController.getAllAccounts);

// Search accounts (Admin only)
router.get('/search', authenticateJWT, authorizeRole(['admin']), accountController.searchAccounts);

// Get account order statistics (Admin, manager, or self) - Must be before /:id route
router.get('/:id/order-statistics', authenticateJWT, accountController.getAccountOrderStatistics);

// Get a single account by ID (Admin or self)
router.get('/:id', authenticateJWT, accountController.getAccountById);

// Update an account (Admin or self)
router.put('/:id', authenticateJWT, accountController.updateAccount);

// Update profile information (Admin or self)
router.put('/change-profile/:id', authenticateJWT, accountController.updateProfile);

// Change password (Admin or self)
router.put('/change-password/:id', authenticateJWT, accountController.updatePassword);

// Soft delete an account (Admin or self)
router.delete('/soft/:id', authenticateJWT, accountController.softDeleteAccount);

// Disable an account (Admin only)
router.put('/disable/:id', authenticateJWT, authorizeRole(['admin']), accountController.disableAccount);

// Delete an account permanently (Admin or self)
router.delete('/:id', authenticateJWT, accountController.deleteAccount);

// Edit Staff Information (Admin only, for staff accounts)
router.put('/edit-staff/:id', authenticateJWT, authorizeRole(['admin']), accountController.editStaffInformation);

module.exports = router;