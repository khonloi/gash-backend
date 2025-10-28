const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/authMiddleware');
const { addProductToLive, removeProductFromLive, getActiveLiveProducts, pinProduct, removePinProduct } = require('../controllers/livestreamProductController');

// Add product to livestream
router.post('/add-live-product', addProductToLive);

// Remove product from livestream
router.post('/remove-live-product', removeProductFromLive);

// Get all active products in a livestream
router.get('/:liveId/live-products', getActiveLiveProducts);

// Pin product
router.post('/:liveProductId/pin-live-product', authenticateJWT, pinProduct);

// Remove pin from product
router.post('/:liveProductId/unpin-live-product', authenticateJWT, removePinProduct);

module.exports = router;
