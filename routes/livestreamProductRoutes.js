const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const { addProductToLive, removeProductFromLive, getActiveLiveProducts, getAllLiveProductsForAdmin, pinProduct, removePinProduct } = require('../controllers/livestreamProductController');

// ===== USER ROUTES (Cần authentication) =====

// Get all active products in a livestream (User và Admin dùng chung - chỉ active products)
router.get('/:liveId/live-products', authenticateJWT, getActiveLiveProducts);

// ===== ADMIN ROUTES (Cần authentication + role) =====

// Add product to livestream (Admin only)
router.post('/add-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), addProductToLive);

// Remove product from livestream (Admin only)
router.post('/remove-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), removeProductFromLive);

// Get all live products including removed (Admin only)
router.get('/:liveId/live-products/all', authenticateJWT, authorizeRole(['admin', 'manager']), getAllLiveProductsForAdmin);

// Pin product (Admin only)
router.post('/:liveProductId/pin-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), pinProduct);

// Remove pin from product (Admin only)
router.post('/:liveProductId/unpin-live-product', authenticateJWT, authorizeRole(['admin', 'manager']), removePinProduct);

module.exports = router;
