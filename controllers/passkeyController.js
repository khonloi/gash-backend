// passkeyController.js
const passkeyService = require('../services/passkeyService');
const { authenticateJWT } = require('../middleware/authMiddleware');

/**
 * Generate registration options for passkey
 * Requires authentication
 */
exports.generateRegistrationOptions = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await passkeyService.generateRegistrationOptions(userId);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error generating registration options', error: error.message });
  }
};

/**
 * Verify registration response and save passkey
 * Requires authentication
 */
exports.verifyRegistration = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Controller: Verifying registration for userId:', userId);
    console.log('Controller: Request body keys:', Object.keys(req.body));
    
    // Get origin from request headers
    const requestOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    console.log('Controller: Request origin:', requestOrigin);
    
    const result = await passkeyService.verifyRegistration(userId, req.body, requestOrigin);
    res.status(result.status).json(result.response);
  } catch (error) {
    console.error('Controller error:', error);
    console.error('Controller error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error verifying registration', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Generate authentication options for passkey login
 * Public endpoint - requires username
 */
exports.generateAuthenticationOptions = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    const result = await passkeyService.generateAuthenticationOptions(username);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error generating authentication options', error: error.message });
  }
};

/**
 * Verify authentication response and login
 * Public endpoint
 */
exports.verifyAuthentication = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    // Get origin from request headers
    const requestOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    console.log('Controller: Request origin for authentication:', requestOrigin);
    
    const result = await passkeyService.verifyAuthentication(username, req.body, requestOrigin);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error verifying authentication', error: error.message });
  }
};

/**
 * Get user's passkeys
 * Requires authentication
 */
exports.getUserPasskeys = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await passkeyService.getUserPasskeys(userId);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error getting user passkeys', error: error.message });
  }
};

/**
 * Delete a passkey
 * Requires authentication
 */
exports.deletePasskey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { passkeyId } = req.params;
    if (!passkeyId) {
      return res.status(400).json({ message: 'Passkey ID is required' });
    }
    const result = await passkeyService.deletePasskey(userId, passkeyId);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting passkey', error: error.message });
  }
};

