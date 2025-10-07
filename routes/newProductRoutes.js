const express = require('express');
const router = express.Router();
const productController = require('../controllers/newProductController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

// Create a new product (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), productController.createProduct);

// Get all products (accessible to all authenticated users, but pending products only for manager/admin)
router.get('/', authenticateJWT, productController.getAllProducts);

// Get a single product by ID (accessible to all authenticated users, but pending products only for manager/admin)
router.get('/:id', authenticateJWT, productController.getProductById);

// Update a product (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.updateProduct);

// Delete a product (restricted to manager/admin)
router.delete('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProduct);

module.exports = router;