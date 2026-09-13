import express from 'express';
import {
  createProductVariant,
  getAllProductVariants,
  getProductVariantById,
  updateProductVariant,
  deleteProductVariant,
  bulkCreateProductVariants
} from '../controllers/productVariantController.js';
import { authenticateJWT, authorizeRole } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createVariantSchema,
  updateVariantSchema,
  bulkCreateVariantSchema
} from '../validations/variantValidation.js';

const router = express.Router();

// Create a new product variant (restricted to manager/admin)
router.post('/', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(createVariantSchema), createProductVariant);

// Get all product variants (accessible to public)
router.get('/get-all-variants', getAllProductVariants);

// Get a single product variant by ID (accessible to public)
router.get('/get-variant-detail/:id', getProductVariantById);

// Update a product variant (restricted to manager/admin)
router.put('/:id', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(updateVariantSchema), updateProductVariant);

// Soft delete a product variant (restricted to manager/admin)
router.delete('/delete-variant/:id', authenticateJWT, authorizeRole(['manager', 'admin']), deleteProductVariant);

// Bulk create product variants (restricted to manager/admin)
router.post('/bulk', authenticateJWT, authorizeRole(['manager', 'admin']), validateRequest(bulkCreateVariantSchema), bulkCreateProductVariants);

export default router;
