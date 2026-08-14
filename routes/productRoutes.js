const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productVariantController = require('../controllers/productVariantController');
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');

router.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path !== '/') {
    return res.redirect(301, req.path.slice(0, -1));
  }
  next();
});

// ==========================================
// 1. PRODUCT ROUTES
// ==========================================

// Create a new product (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), productController.createProduct);

// Get all products (accessible to public, optional auth for role-based visibility)
router.get('/', optionalAuth, productController.getAllProducts);

// Search products by name and status
router.get('/search', optionalAuth, productController.searchProducts);

// Get a single product by ID
router.get('/:id', optionalAuth, productController.getProductById);

// Update a product (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.updateProduct);

// Soft delete a product (restricted to manager/admin)
router.delete('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProduct);

// Add a product image (restricted to manager/admin)
router.post('/:id/images', authenticateJWT, authorizeRole(['manager', 'admin']), productController.addProductImage);

// Delete a product image (restricted to manager/admin)
router.delete('/:id/images/:imageId', authenticateJWT, authorizeRole(['manager', 'admin']), productController.deleteProductImage);

// ==========================================
// 2. PRODUCT VARIANT ROUTES
// ==========================================

// Create a new product variant (restricted to manager/admin)
router.post('/create-variant', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.createProductVariant);

// Get all product variants (accessible to public)
router.get('/get-all-variants', productVariantController.getAllProductVariants);

// Get a single product variant by ID (accessible to public)
router.get('/get-variant-detail/:id', productVariantController.getProductVariantById);

// Update a product variant (restricted to manager/admin)
router.put('/update-variant/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.updateProductVariant);

// Soft delete a product variant (restricted to manager/admin)
router.delete('/delete-variant/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.deleteProductVariant);

// Bulk create product variants (restricted to manager/admin)
router.post('/bulk-create-variants', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.bulkCreateProductVariants);

module.exports = router;