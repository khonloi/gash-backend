const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

const livestreamController = require('../controllers/livestreamController');
const livestreamProductController = require('../controllers/livestreamProductController');
const livestreamCommentController = require('../controllers/livestreamCommentController');
const livestreamReactionController = require('../controllers/livestreamReactionController');

// ==========================================
// 1. CORE LIVESTREAM ROUTES
// ==========================================

// USER ROUTES
// Get currently live streams (User can only see live streams)
router.get('/live-now', authenticateJWT, livestreamController.getLiveNow);

// Join livestream (view)
router.post('/join', authenticateJWT, livestreamController.joinLivestream);

// Leave livestream
router.post('/leave', authenticateJWT, livestreamController.leaveLivestream);

// ADMIN ROUTES
// Start livestream
router.post('/start', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.startLivestream);

// End livestream (host or admin only - checked in service)
router.put('/end', authenticateJWT, livestreamController.endLivestream);

// Get host's livestreams
router.get('/my-livestream', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getHostLivestreams);

// Generate host token to join livestream
router.post('/host-token', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getHostToken);

// Get all livestreams 
router.get('/all-livestream', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getAllLive);

// Get specific livestream details (Admin only)
router.get('/livestream-by-id/:livestreamId', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamController.getLiveById);

// ==========================================
// 2. LIVESTREAM PRODUCT ROUTES
// ==========================================

// Get all active products in a livestream (User & Admin - active products only)
router.get('/:liveId/live-products', authenticateJWT, livestreamProductController.getActiveLiveProducts);

// Add product to livestream (Admin only)
router.post('/add-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamProductController.addProductToLive);

// Remove product from livestream (Admin only)
router.post('/remove-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamProductController.removeProductFromLive);

// Get all live products including removed (Admin only)
router.get('/:liveId/live-products/all', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamProductController.getAllLiveProductsForAdmin);

// Pin product (Admin only)
router.post('/:liveProductId/pin-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamProductController.pinProduct);

// Remove pin from product (Admin only)
router.post('/:liveProductId/unpin-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamProductController.removePinProduct);

// ==========================================
// 3. LIVESTREAM COMMENT ROUTES
// ==========================================

// Add comment to livestream
router.post('/add-comment', authenticateJWT, livestreamCommentController.addComment);

// Get comments for a livestream (User - only non-deleted comments)
router.get('/comments/:liveId', authenticateJWT, livestreamCommentController.getUserLiveComments);

// Get comments for a livestream (Admin - all comments, including deleted)
router.get('/admin/comments/:liveId', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.getAdminLiveComments);

// Hide/Delete comment (Sender or Admin/Manager)
router.delete('/:commentId/hide-comment', authenticateJWT, livestreamCommentController.hideComment);

// Pin comment (Admin only)
router.post('/:commentId/pin-comment', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.pinComment);

// Remove pin from comment (Admin only)
router.post('/:commentId/unpin-comment', authenticateJWT, authorizeRole(['admin', 'manager']), livestreamCommentController.removePinComment);

// ==========================================
// 4. LIVESTREAM REACTION ROUTES
// ==========================================

// Add reaction to livestream
router.post('/add-reaction', authenticateJWT, livestreamReactionController.addReaction);

// Get reaction counts for a livestream 
router.get('/reactions/:liveId', authenticateJWT, livestreamReactionController.getLiveReactions);

module.exports = router;
