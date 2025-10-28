const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/authMiddleware');
const livestreamReactionController = require('../controllers/livestreamReactionController');

// ===== USER ROUTES (Cần authentication) =====

// Add reaction to livestream
router.post('/add-reaction', authenticateJWT, livestreamReactionController.addReaction);

// Get reactions for a livestream
router.get('/reactions/:liveId', authenticateJWT, livestreamReactionController.getLiveReactions);

module.exports = router;

