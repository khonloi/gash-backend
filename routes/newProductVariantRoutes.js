const express = require('express');
const router = express.Router();
const productVariantController = require('../controllers/newProductVariantController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

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