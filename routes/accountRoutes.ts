import express from 'express';
import { 
  createAccount, 
  getAllAccounts, 
  getAccountById, 
  updateAccount, 
  updatePassword, 
  softDeleteAccount, 
  getAccountOrderStatistics 
} from '../controllers/accountController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { updateAccountSchema, updatePasswordSchema } from '../validations/accountValidation.js';
// We will still import authMiddleware as standard CommonJS (requires fixing if authMiddleware isn't migrated, but this works in tsx)
import { authenticateJWT, authorizeRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Note: To use require() based CommonJS modules in ESM, we would need to handle them differently if fully strict, 
// but tsx handles `import { x } from './authMiddleware.js'` even if it's CJS.

// Create a new account (Admin only) - Requires registerSchema (can use updateAccountSchema for now or create register)
router.post('/', authenticateJWT, authorizeRole(['admin']), validateRequest(updateAccountSchema), createAccount);

// Get all accounts (Admin only)
router.get('/', authenticateJWT, authorizeRole(['admin']), getAllAccounts);

// Get account order statistics (Admin, manager, or self)
router.get('/:id/order-statistics', authenticateJWT, getAccountOrderStatistics);

// Get a single account by ID (Admin or self)
router.get('/:id', authenticateJWT, getAccountById);

// Update an account (Admin or self)
router.put('/:id', authenticateJWT, validateRequest(updateAccountSchema), updateAccount);

// Update profile alias (Admin or self)
router.put('/change-profile/:id', authenticateJWT, validateRequest(updateAccountSchema), updateAccount);

// Change password (Admin or self)
router.put('/change-password/:id', authenticateJWT, validateRequest(updatePasswordSchema), updatePassword);

// Soft delete an account (Admin or self)
router.delete('/soft/:id', authenticateJWT, softDeleteAccount);
router.delete('/:id', authenticateJWT, softDeleteAccount);

export default router;
