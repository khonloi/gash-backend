const express = require('express');
const router = express.Router();
const livestreamController = require('../controllers/livestreamController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');


// ===== USER ROUTES (Cần authentication) =====

// Get currently live streams (User can only see live streams)
router.get('/live-now', authenticateJWT, livestreamController.getLiveNow);

// Join livestream (view)
router.post('/join', authenticateJWT, livestreamController.joinLivestream);

// Leave livestream
router.post('/leave', authenticateJWT, livestreamController.leaveLivestream);


// ===== ADMIN ROUTES (Cần authentication + role) =====
// Start livestream
router.post('/start', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.startLivestream);

// End livestream
router.put('/end', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.endLivestream);

// Get host's livestreams
router.get('/my-livestream', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getHostLivestreams);

// dùng để tạo token cho host, để host có thể join livestream
router.post('/host-token', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getHostToken);

// Get all livestreams 
router.get('/all-livestream', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getAllLive);

// Get specific livestream details
router.get('/livestream-by-id/:livestreamId', authenticateJWT, livestreamController.getLiveById);

module.exports = router;
