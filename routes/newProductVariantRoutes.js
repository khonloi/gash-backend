const express = require('express');
const router = express.Router();
const productVariantController = require('../controllers/newProductVariantController');
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');

// Create a new product variant (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.createProductVariant);

// Get all product variants (accessible to all authenticated users)
router.get('/', authenticateJWT, productVariantController.getAllProductVariants);

// Get a single product variant by ID (accessible to all authenticated users)
router.get('/:id', authenticateJWT, productVariantController.getProductVariantById);

// Update a product variant (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.updateProductVariant);

// Delete a product variant (restricted to manager/admin)
router.delete('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.deleteProductVariant);

module.exports = router;