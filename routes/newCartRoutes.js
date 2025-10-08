const express = require('express');
const { authenticateJWT } = require('../middleware/authMiddleware');
const newCartController = require('../controllers/newCartController');

const router = express.Router();

// POST /api/newCart - Create
router.post('/', authenticateJWT, newCartController.createCartItem);

// GET /api/newCart/account/:accountId - Get by account
router.get('/account/:accountId', authenticateJWT, newCartController.getCartByAccount);

// GET /api/newCart/:cartId - Get by ID
router.get('/:cartId', authenticateJWT, newCartController.getCartItemById);

// PUT /api/newCart/:cartId - Update
router.put('/:cartId', authenticateJWT, newCartController.updateCartItem);

// DELETE /api/newCart/:cartId - Delete
router.delete('/:cartId', authenticateJWT, newCartController.deleteCartItem);

module.exports = router;