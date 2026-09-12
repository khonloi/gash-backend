const express = require('express');
const router = express.Router();
const productVariantController = require('../controllers/ProductVariantController');
const { authenticateJWT, authorizeRole, optionalAuth } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const { createVariantSchema, updateVariantSchema, bulkCreateVariantSchema } = require('../validations/variantValidation');

// Create a new product variant (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(createVariantSchema), productVariantController.createProductVariant);

// Get all product variants (accessible to public)
router.get('/get-all-variants', productVariantController.getAllProductVariants);

// Get a single product variant by ID (accessible to public)
router.get('/get-variant-detail/:id', productVariantController.getProductVariantById);

// Update a product variant (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(updateVariantSchema), productVariantController.updateProductVariant);

// Soft delete a product variant (restricted to manager/admin)
router.delete('/delete-variant/:id', authenticateJWT, authorizeRole(['manager', 'admin']), productVariantController.deleteProductVariant);

// Bulk create product variants (restricted to manager/admin)
router.post('/bulk', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(bulkCreateVariantSchema), productVariantController.bulkCreateProductVariants);

module.exports = router;