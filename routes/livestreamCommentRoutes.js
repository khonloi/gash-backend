const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const livestreamCommentController = require('../controllers/livestreamCommentController');

// ===== USER ROUTES (Cần authentication) =====

// Add comment to livestream
router.post('/add-comment', authenticateJWT, livestreamCommentController.addComment);

// Get comments for a livestream (User - only non-deleted comments)
router.get('/comments/:liveId', authenticateJWT, livestreamCommentController.getUserLiveComments);


// ===== ADMIN ROUTES (Cần authentication + role) =====

// Get comments for a livestream (Admin - all comments, including deleted)
router.get('/admin/comments/:liveId', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.getAdminLiveComments);

// Hide/Delete comment (Sender hoặc Admin/Manager)
router.delete('/:commentId/hide-comment', authenticateJWT, livestreamCommentController.hideComment);

// Pin comment (Admin only)
router.post('/:commentId/pin-comment', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.pinComment);

// Remove pin from comment (Admin only)
router.post('/:commentId/unpin-comment', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.removePinComment);

module.exports = router;
