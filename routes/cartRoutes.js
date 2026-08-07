const express = require('express');
const { authenticateJWT } = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');

const router = express.Router();

// POST /api/cart - Create
router.post('/', authenticateJWT, cartController.createCartItem);

// GET /api/cart/account/:accountId - Get by account
router.get('/account/:accountId', authenticateJWT, cartController.getCartByAccount);

// GET /api/cart/:cartId - Get by ID
router.get('/:cartId', authenticateJWT, cartController.getCartItemById);

// PUT /api/cart/:cartId - Update
router.put('/:cartId', authenticateJWT, cartController.updateCartItem);

// DELETE /api/cart/:cartId - Delete
router.delete('/:cartId', authenticateJWT, cartController.deleteCartItem);

module.exports = router;