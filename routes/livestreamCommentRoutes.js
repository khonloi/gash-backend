const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/authMiddleware');
const livestreamCommentController = require('../controllers/livestreamCommentController');

// ===== USER ROUTES (Cần authentication) =====

// Add comment to livestream
router.post('/add-comment', authenticateJWT, livestreamCommentController.addComment);

// Get comments for a livestream (User - only non-deleted) + admin
router.get('/comments/:liveId', authenticateJWT, livestreamCommentController.getUserLiveComments);

// Delete comment
router.delete('/:commentId/hide-comment', authenticateJWT, livestreamCommentController.hideComment);

// Pin comment
router.post('/:commentId/pin-comment', authenticateJWT, livestreamCommentController.pinComment);

// Remove pin from comment
router.post('/:commentId/unpin-comment', authenticateJWT, livestreamCommentController.removePinComment);

module.exports = router;
