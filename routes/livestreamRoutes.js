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

// Get live streams
router.get('/live', authenticateJWT, livekitController.getLiveStreams);

// View livestream (join)
router.post('/view', authenticateJWT, livekitController.joinLivestream);

// ===== ADMIN ROUTES (Cần authentication + role) =====

// Start livestream
router.post('/start', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.startLivestream);

// End livestream
router.put('/end', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.endLivestream);

// Get host livestreams
router.get('/host', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.getHostLivestreams);

// Get host token
router.post('/token', authenticateJWT, authorizeRole(['admin', 'manager']), livekitController.getHostToken);

module.exports = router;
