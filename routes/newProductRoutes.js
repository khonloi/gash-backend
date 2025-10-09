const express = require('express');
const router = express.Router();
const productController = require('../controllers/newProductController');
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');

// Create a new product (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), productController.createProduct);

// Get all products (accessible to public, but detects admin/manager for showing all products)
router.get('/', optionalAuth, productController.getAllProducts);

// Get a single product by ID (accessible to public, but detects admin/manager)
router.get('/:id', optionalAuth, productController.getProductById);

// Update a product (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.updateProduct);

// Soft delete a product (restricted to manager/admin)
router.delete('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProduct);

module.exports = router;