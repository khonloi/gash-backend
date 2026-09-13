import express from 'express';
import {
  createProductColor,
  getAllProductColors,
  getProductColorById,
  updateProductColor,
  deleteProductColor,
  createProductSize,
  getAllProductSizes,
  getProductSizeById,
  updateProductSize,
  deleteProductSize,
} from '../controllers/specificationController.js';
import { authenticateJWT, authorizeRole } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createColorSchema,
  updateColorSchema,
  createSizeSchema,
  updateSizeSchema,
} from '../validations/specificationValidation.js';

const router = express.Router();

// --- Product Colors Routes ---
router.post('/create-color', authenticateJWT, authorizeRole(['admin', 'manager']), validateRequest(createColorSchema), createProductColor);
router.get('/get-all-colors', getAllProductColors);
router.get('/get-color-detail/:id', getProductColorById);
router.put('/update-color/:id', authenticateJWT, authorizeRole(['admin', 'manager']), validateRequest(updateColorSchema), updateProductColor);
router.delete('/delete-color/:id', authenticateJWT, authorizeRole(['admin', 'manager']), deleteProductColor);

// --- Product Sizes Routes ---
router.post('/create-size', authenticateJWT, authorizeRole(['admin', 'manager']), validateRequest(createSizeSchema), createProductSize);
router.get('/get-all-sizes', getAllProductSizes);
router.get('/get-size-detail/:id', getProductSizeById);
router.put('/update-size/:id', authenticateJWT, authorizeRole(['admin', 'manager']), validateRequest(updateSizeSchema), updateProductSize);
router.delete('/delete-size/:id', authenticateJWT, authorizeRole(['admin', 'manager']), deleteProductSize);

export default router;
