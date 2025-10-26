const express = require('express');
const router = express.Router();
const livekitController = require('../controllers/livekitController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

// ===== PUBLIC ROUTES (Không cần authentication) =====

// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Livestream API is working',
        platform: 'livekit',
        timestamp: new Date().toISOString()
    });
});

// ===== USER ROUTES (Cần authentication) =====

// Get live streams (currently live only)
router.get('/live', authenticateJWT, livekitController.getLiveStreams);

// Get all livestreams (with pagination)
router.get('/all', authenticateJWT, livekitController.getAllLive);

// Get currently live streams only
router.get('/now/live', authenticateJWT, livekitController.getLiveNow);

// View livestream (join)
router.post('/view', authenticateJWT, livekitController.joinLivestream);

// Leave livestream
router.post('/leave', authenticateJWT, livekitController.leaveLivestream);

// ===== ADMIN ROUTES (Cần authentication + role) =====

// Start livestream
router.post('/start', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.startLivestream);

// End livestream
router.put('/end', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.endLivestream);

// Get host livestreams
router.get('/host', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.getHostLivestreams);

// Get host token
router.post('/token', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.getHostToken);

// Get specific livestream details (dynamic route, placed last)
router.get('/:livestreamId', authenticateJWT, livekitController.getLive);

module.exports = router;
