const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');

router.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path !== '/') {
    return res.redirect(301, req.path.slice(0, -1));
  }
  next();
});

// Create a new product (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), productController.createProduct);

// Get all products (accessible to public, optional auth for role-based visibility)
router.get('/', optionalAuth, productController.getAllProducts);

// Search products by name and status (accessible to public, optional auth for role-based visibility)
router.get('/search', optionalAuth, productController.searchProducts);

// Get a single product by ID (accessible to public, optional auth for role-based visibility)
router.get('/:id', optionalAuth, productController.getProductById);

// Update a product (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.updateProduct);

// Soft delete a product (restricted to manager/admin)
router.delete('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProduct);

// Add a product image (restricted to manager/admin)
router.post('/:id/images', authenticateJWT, authorizeRole(['manager', 'admin']), productController.addProductImage);

// Delete a product image (restricted to manager/admin)
router.delete('/:id/images/:imageId', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProductImage);

module.exports = router;