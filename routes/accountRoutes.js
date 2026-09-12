const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const accountController = require('../controllers/accountController');
const { registerSchema } = require('../validations/authValidation');
const { updateAccountSchema, updatePasswordSchema } = require('../validations/accountValidation');

// Create a new account (Admin only) - Reuses registerSchema for validation
router.post('/', authenticateJWT, authorizeRole(['admin']), validateRequest(registerSchema), accountController.createAccount);

// Get all accounts (Admin only)
router.get('/', authenticateJWT, authorizeRole(['admin']), accountController.getAllAccounts);

// Search accounts (Admin only)
router.get('/search', authenticateJWT, authorizeRole(['admin']), accountController.searchAccounts);

// Get account order statistics (Admin, manager, or self)
router.get('/:id/order-statistics', authenticateJWT, accountController.getAccountOrderStatistics);

// Get a single account by ID (Admin or self)
router.get('/:id', authenticateJWT, accountController.getAccountById);

// Update an account (Admin or self)
router.put('/:id', authenticateJWT, validateRequest(updateAccountSchema), accountController.updateAccount);

// Update profile (Admin or self)
router.put('/change-profile/:id', authenticateJWT, validateRequest(updateAccountSchema), accountController.updateProfile);

// Change password (Admin or self)
router.put('/change-password/:id', authenticateJWT, validateRequest(updatePasswordSchema), accountController.updatePassword);

// Soft delete an account (Admin or self)
router.delete('/soft/:id', authenticateJWT, accountController.softDeleteAccount);

// Disable an account (Admin only)
router.put('/disable/:id', authenticateJWT, authorizeRole(['admin']), accountController.disableAccount);

// Delete an account permanently (Admin or self)
router.delete('/:id', authenticateJWT, accountController.deleteAccount);

// Edit Staff Information (Admin only)
router.put('/edit-staff/:id', authenticateJWT, authorizeRole(['admin']), validateRequest(updateAccountSchema), accountController.editStaffInformation);

module.exports = router;