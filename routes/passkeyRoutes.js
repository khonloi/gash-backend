const express = require('express');
const router = express.Router();
const passkeyController = require('../controllers/passkeyController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Public routes (for authentication)
router.post('/auth/generate', passkeyController.generateAuthenticationOptions);
router.post('/auth/verify', passkeyController.verifyAuthentication);

// Protected routes (require authentication)
router.post('/register/generate', authenticateJWT, passkeyController.generateRegistrationOptions);
router.post('/register/verify', authenticateJWT, passkeyController.verifyRegistration);
router.get('/list', authenticateJWT, passkeyController.getUserPasskeys);
router.delete('/:passkeyId', authenticateJWT, passkeyController.deletePasskey);

module.exports = router;

